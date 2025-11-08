from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Store, MenuItem, Order, OrderItem
import openai
from django.conf import settings
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import re

# --- Helper Functions ---

def get_category_from_item(item_name):
    """Extracts a representative category from a menu item name."""
    # This can be expanded or made more sophisticated
    if '버거' in item_name: return '버거'
    if '커피' in item_name or '라떼' in item_name: return '커피'
    if '김밥' in item_name: return '김밥'
    if '마라탕' in item_name or '마라샹궈' in item_name: return '마라'
    if '떡볶이' in item_name or '라면' in item_name: return '분식'
    if '토스트' in item_name: return '토스트'
    if '스무디' in item_name or '티' in item_name or '에이드' in item_name: return '음료'
    if '베이글' in item_name or '크로와상' in item_name: return '베이커리'
    if '샌드위치' in item_name: return '샌드위치'
    if '과일' in item_name: return '과일'
    return None

def simple_nlu(text, conversation_state=None):
    """
    A simple Natural Language Understanding function to detect user intent and entities.
    Refactored to be more structured and context-aware.
    """
    intent = {'intent': 'unknown', 'entities': {}}
    text = text.lower().strip()

    # --- Entity Extraction ---
    all_stores = list(Store.objects.values_list('name', flat=True))
    food_categories = ['버거', '커피', '김밥', '마라', '분식', '토스트', '음료', '베이거리', '샌드위치', '과일']
    
    for store in all_stores:
        if store.lower() in text:
            intent['entities']['store_name'] = store
            break
    
    for category in food_categories:
        if category in text:
            intent['entities']['category'] = category
            break

    # --- Intent Detection (Priority-based) ---

    # 1. Confirmation/Rejection
    confirmation_keywords = ['네', '응', '예', '맞아', '좋아', '그렇게']
    if any(kw in text for kw in confirmation_keywords):
        # More specific confirmation logic is handled in the view based on conversation_state
        intent['intent'] = 'affirm'
        return intent

    # 2. Order Finalization / Payment
    finalization_keywords = ['포장이요', '배달이요', '주문 완료', '결제', '계산', '돈 낼게']
    if any(kw in text for kw in finalization_keywords):
        intent['intent'] = 'finalize_order'
        return intent

    # 3. List Menu by Store
    menu_query_keywords = ['메뉴', '뭐 팔아', '메뉴판', '뭐 있어']
    if 'store_name' in intent['entities'] and any(kw in text for kw in menu_query_keywords):
        intent['intent'] = 'list_menu_by_store'
        return intent
    # If user just says a store name, and we were expecting it
    if 'store_name' in intent['entities'] and conversation_state and conversation_state.get('presented_stores'):
        if intent['entities']['store_name'] in conversation_state['presented_stores']:
            intent['intent'] = 'list_menu_by_store'
            return intent

    # 4. Find Stores by Category
    store_query_keywords = ['가게', '어디', '파는 곳', '매장']
    if 'category' in intent['entities'] and any(kw in text for kw in store_query_keywords):
        intent['intent'] = 'find_stores_by_category'
        return intent

    # 5. Order Food (if item name is detected)
    # This is a fallback, as more complex orders are handled by the AI
    menu_item_match = MenuItem.objects.filter(name__icontains=text).first()
    if menu_item_match:
        intent['intent'] = 'order_food'
        intent['entities']['item_name'] = menu_item_match.name
        intent['entities']['quantity'] = 1 # Default quantity
        return intent

    # Fallback to general query
    intent['intent'] = 'general_query'
    return intent


@method_decorator(csrf_exempt, name='dispatch')
class ChatWithAIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        try:
            history = request.data.get('history', [])
            user_message = request.data.get('message')
            current_order_state = request.data.get('currentState', {})
            conversation_state = request.data.get('conversationState', {})

            if not user_message:
                return Response({'error': 'Message not provided'}, status=status.HTTP_400_BAD_REQUEST)

            # --- 1. NLU to get intent and entities ---
            nlu_result = simple_nlu(user_message, conversation_state)
            intent = nlu_result['intent']
            entities = nlu_result['entities']

            # --- 2. Handle structured intents directly ---

            # Intent: Find stores selling a food category
            if intent == 'find_stores_by_category':
                category = entities['category']
                stores = Store.objects.filter(menuitem__name__icontains=category).distinct()
                if stores:
                    store_names = [store.name for store in stores]
                    reply = f"'{category}' 메뉴를 판매하는 가게는 {', '.join(store_names)}입니다. 어느 가게 메뉴를 보시겠어요?"
                    conversation_state['last_inquired_category'] = category
                    conversation_state['presented_stores'] = store_names
                else:
                    reply = f"죄송하지만 '{category}' 메뉴를 판매하는 가게를 찾지 못했습니다."
                    conversation_state = {} # Reset state
                return Response({
                    'reply': reply,
                    'currentOrder': current_order_state,
                    'conversationState': conversation_state
                })

            # Intent: List menu for a selected store
            if intent == 'list_menu_by_store':
                store_name = entities['store_name']
                menu_items = MenuItem.objects.filter(store__name__iexact=store_name)
                if menu_items:
                    menu_list = [f"{item.name}({int(item.price)}원)" for item in menu_items]
                    reply = f"'{store_name}'의 메뉴는 {', '.join(menu_list)}입니다. 무엇을 주문하시겠어요?"
                else:
                    reply = f"죄송하지만 '{store_name}'의 메뉴 정보를 찾을 수 없습니다."
                
                # Clear conversation state after showing menu
                conversation_state = {} 
                return Response({
                    'reply': reply,
                    'currentOrder': current_order_state,
                    'conversationState': conversation_state
                })

            # --- 3. Fallback to OpenAI for general queries and complex orders ---
            openai.api_key = settings.OPENAI_API_KEY
            
            system_prompt = (
                "너는 AI 키오스크 '보이스오더'의 친절한 안내원이야. 너의 목표는 사용자가 DB에 있는 메뉴를 주문하도록 돕는 거야."
                "1. **DB 검색 결과 활용:** 사용자가 메뉴, 가게, 추천을 물어보면, 반드시 'DB 검색 결과' 섹션에 제공된 정보만을 사용해서 답변해야 해. 'DB 검색 결과'에 없는 것은 절대 언급하거나 제안해서는 안 돼."
                "2. **주문 처리:** 사용자가 특정 메뉴를 주문하면, 'DB 검색 결과'에 있는 정확한 메뉴 이름과 가격을 확인하고, '[메뉴이름]을 장바구니에 담을까요?'라고 명확하게 되물어봐. 사용자가 '네'라고 답하면 주문이 처리될 거야."
                "3. **추천 요청 처리:** 사용자가 '추천해줘' 또는 '뭐 먹을까?' 같이 일반적인 요청을 하면, 'DB 검색 결과'에 있는 '주문 가능한 주요 음식 종류'를 먼저 알려주고, 사용자가 선택하게 해야 해. 예: '현재 주문 가능한 음식 종류는 버거, 김밥, 커피 등이 있어요. 어떤 종류로 추천해드릴까요?'"
                "4. **없는 메뉴 처리:** 사용자가 'DB 검색 결과'에 없는 메뉴나 음식 종류를 말하면, '죄송하지만, 요청하신 메뉴는 현재 제공되지 않아요. 대신 주문 가능한 [주요 음식 종류] 중에서 골라보시겠어요?'라고 정중하게 거절하고, 주문 가능한 옵션을 안내해야 해."
                "5. **대화 기억 및 명확한 안내:** 사용자와의 이전 대화를 기억해서, 대화가 끊기지 않고 자연스럽게 주문으로 이어지도록 해야 해. 가게 이름, 메뉴 이름, 가격을 명확하게 말해서 사용자가 혼동하지 않게 해야 해."
            )
            
            # Build DB search result for the AI prompt
            db_search_result = ""
            all_items = MenuItem.objects.all().select_related('store')
            
            # Find all available categories
            available_categories = set()
            for item in all_items:
                category = get_category_from_item(item.name)
                if category:
                    available_categories.add(category)

            # Find items relevant to the user's message
            items_to_display = []
            search_query = user_message
            
            # A simple search logic
            q_objects = Q()
            if 'category' in entities:
                q_objects |= Q(name__icontains=entities['category'])
            if 'store_name' in entities:
                q_objects |= Q(store__name__icontains=entities['store_name'])
            
            # If no specific entity, search the whole message
            if not q_objects:
                q_objects |= Q(name__icontains=search_query) | Q(store__name__icontains=search_query)

            items_to_display = all_items.filter(q_objects).distinct()

            # Format the search result string
            stores_data = {}
            if items_to_display:
                for item in items_to_display:
                    if item.store.name not in stores_data:
                        stores_data[item.store.name] = []
                    stores_data[item.store.name].append(f"{item.name}({int(item.price)}원)")
            
            result_texts = []
            if available_categories:
                result_texts.append(f"주문 가능한 주요 음식 종류: {', '.join(sorted(list(available_categories)))}")

            if stores_data:
                for store_name, items in sorted(stores_data.items()):
                    result_texts.append(f"'{store_name}' 메뉴: {', '.join(items)}")
            
            if result_texts:
                db_search_result = " ".join(result_texts)
            else:
                db_search_result = f"검색 결과 없음. 주문 가능한 주요 음식 종류는 {', '.join(sorted(list(available_categories)))}입니다."


            from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Store, MenuItem, Order, OrderItem
import openai
from django.conf import settings
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import re

# --- Helper Functions ---

def get_category_from_item(item_name):
    """Extracts a representative category from a menu item name."""
    if '버거' in item_name: return '버거'
    if '커피' in item_name or '라떼' in item_name: return '커피'
    if '김밥' in item_name: return '김밥'
    if '마라탕' in item_name or '마라샹궈' in item_name: return '마라'
    if '떡볶이' in item_name or '라면' in item_name: return '분식'
    if '토스트' in item_name: return '토스트'
    if '스무디' in item_name or '티' in item_name or '에이드' in item_name: return '음료'
    if '베이글' in item_name or '크로와상' in item_name: return '베이커리'
    if '샌드위치' in item_name: return '샌드위치'
    if '과일' in item_name: return '과일'
    return None

def simple_nlu(text): # Removed conversation_state from NLU for cleaner separation
    """
    A simple Natural Language Understanding function to detect user intent and entities.
    Focuses on extracting entities and basic direct intents.
    """
    intent = {'intent': 'unknown', 'entities': {}}
    text = text.lower().strip()

    # --- Entity Extraction ---
    all_stores = list(Store.objects.values_list('name', flat=True))
    food_categories = ['버거', '커피', '김밥', '마라', '분식', '토스트', '음료', '베이커리', '샌드위치', '과일']
    
    for store in all_stores:
        if store.lower() in text:
            intent['entities']['store_name'] = store
            break
    
    for category in food_categories:
        if category in text:
            intent['entities']['category'] = category
            break

    # --- Basic Direct Intent Detection ---

    # Order Finalization / Payment
    finalization_keywords = ['포장이요', '배달이요', '주문 완료', '결제', '계산', '돈 낼게']
    if any(kw in text for kw in finalization_keywords):
        intent['intent'] = 'finalize_order'
        return intent

    # Order Food (if item name is detected)
    menu_item_match = MenuItem.objects.filter(name__icontains=text).first()
    if menu_item_match:
        intent['intent'] = 'order_food'
        intent['entities']['item_name'] = menu_item_match.name
        intent['entities']['quantity'] = 1 # Default quantity
        return intent

    # Affirmation
    confirmation_keywords = ['네', '응', '예', '맞아', '좋아', '그렇게']
    if any(kw in text for kw in confirmation_keywords):
        intent['intent'] = 'affirm'
        return intent

    # General query (default)
    return intent


@method_decorator(csrf_exempt, name='dispatch')
class ChatWithAIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        try:
            history = request.data.get('history', [])
            user_message = request.data.get('message')
            current_order_state = request.data.get('currentState', {})
            conversation_state = request.data.get('conversationState', {})

            if not user_message:
                return Response({'error': 'Message not provided'}, status=status.HTTP_400_BAD_REQUEST)

            # --- 1. NLU to get entities and basic intent ---
            nlu_result = simple_nlu(user_message)
            basic_intent = nlu_result['intent']
            entities = nlu_result['entities']
            
            # --- 2. Resolve actual intent based on conversation_state ---
            actual_intent = basic_intent

            # If AI previously asked for a category, and user provides one
            if conversation_state.get('awaiting_category_selection') and 'category' in entities:
                actual_intent = 'find_stores_by_category'
                conversation_state['awaiting_category_selection'] = False # Reset flag
            
            # If AI previously presented stores, and user provides a store name
            elif conversation_state.get('awaiting_store_selection') and 'store_name' in entities:
                actual_intent = 'list_menu_by_store'
                conversation_state['awaiting_store_selection'] = False # Reset flag
            
            # If user asks for stores by category directly (e.g., "커피 가게")
            elif 'category' in entities and any(kw in user_message.lower() for kw in ['가게', '어디', '파는 곳', '매장']):
                actual_intent = 'find_stores_by_category'
            
            # If user asks for menu by store directly (e.g., "롯데리아 메뉴")
            elif 'store_name' in entities and any(kw in user_message.lower() for kw in ['메뉴', '뭐 팔아', '메뉴판', '뭐 있어']):
                actual_intent = 'list_menu_by_store'
            
            # If user asks for recommendation and provides a category (e.g., "커피요" after "메뉴 추천해주세요")
            elif basic_intent == 'general_query' and 'category' in entities:
                # Check if the previous AI message was a general category suggestion
                last_assistant_message = next((msg.get('text') for msg in reversed(history) if msg.get('sender') == 'assistant'), '')
                if "주문 가능한 음식 종류는" in last_assistant_message:
                    actual_intent = 'find_stores_by_category'
                    conversation_state['awaiting_category_selection'] = False # Reset flag as category is now provided

            # --- 3. Handle structured intents directly ---

            # Intent: Find stores selling a food category
            if actual_intent == 'find_stores_by_category':
                category = entities.get('category') or conversation_state.get('last_inquired_category') # Use entity or remembered category
                if not category: # If no category found in current message or state, fallback to AI
                    actual_intent = 'general_query' # Let OpenAI handle it
                else:
                    stores = Store.objects.filter(menuitem__name__icontains=category).distinct()
                    if stores:
                        store_names = [store.name for store in stores]
                        reply = f"'{category}' 메뉴를 판매하는 가게는 {', '.join(store_names)}입니다. 어느 가게 메뉴를 보시겠어요?"
                        conversation_state['last_inquired_category'] = category
                        conversation_state['presented_stores'] = store_names
                        conversation_state['awaiting_store_selection'] = True # Set flag
                    else:
                        reply = f"죄송하지만 '{category}' 메뉴를 판매하는 가게를 찾지 못했습니다."
                        conversation_state = {} # Reset state
                    return Response({
                        'reply': reply,
                        'currentOrder': current_order_state,
                        'conversationState': conversation_state
                    })

            # Intent: List menu for a selected store
            if actual_intent == 'list_menu_by_store':
                store_name = entities.get('store_name')
                if not store_name: # If no store name found, fallback to AI
                    actual_intent = 'general_query' # Let OpenAI handle it
                else:
                    # Optional: Check if this store was in the presented_stores from conversation_state for better context
                    if conversation_state.get('awaiting_store_selection') and store_name not in conversation_state.get('presented_stores', []):
                        reply = f"죄송하지만 '{store_name}'은(는 현재 제시된 가게 목록에 없습니다. 다른 가게를 선택해 주시겠어요?"
                        return Response({
                            'reply': reply,
                            'currentOrder': current_order_state,
                            'conversationState': conversation_state
                        })

                    menu_items = MenuItem.objects.filter(store__name__iexact=store_name)
                    if menu_items:
                        menu_list = [f"{item.name}({int(item.price)}원)" for item in menu_items]
                        reply = f"'{store_name}'의 메뉴는 {', '.join(menu_list)}입니다. 무엇을 주문하시겠어요?"
                    else:
                        reply = f"죄송하지만 '{store_name}'의 메뉴 정보를 찾을 수 없습니다."
                    
                    # Clear conversation state after showing menu
                    conversation_state = {} 
                    return Response({
                        'reply': reply,
                        'currentOrder': current_order_state,
                        'conversationState': conversation_state
                    })
            
            # Intent: Affirmation (e.g., "네") - context dependent
            if actual_intent == 'affirm':
                # If AI previously asked for category selection
                if conversation_state.get('awaiting_category_selection'):
                    # This case should ideally be handled by user providing a category, not just "네"
                    # For now, let AI handle it as a general query
                    actual_intent = 'general_query'
                # If AI previously asked for store selection
                elif conversation_state.get('awaiting_store_selection'):
                    # This case should ideally be handled by user providing a store name, not just "네"
                    # For now, let AI handle it as a general query
                    actual_intent = 'general_query'
                # If AI previously asked for order confirmation
                elif "주문하실 건가요?" in history[-1].get('text', ''):
                    # Re-trigger order_food intent with item from history
                    match = re.search(r"(\S+)의 (\S+)는 (\d+)원이에요\. 주문하실 건가요\?", history[-1].get('text', ''))
                    if match:
                        item_name = match.group(2)
                        # Simulate order_food intent
                        actual_intent = 'order_food'
                        entities['item_name'] = item_name
                        entities['quantity'] = 1 # Assume 1 for confirmation
                else:
                    actual_intent = 'general_query' # Fallback to AI for other affirmations

            # Intent: Order Food (direct item mention or confirmation)
            if actual_intent == 'order_food' and entities.get('item_name'):
                item_name = entities['item_name']
                quantity = entities.get('quantity', 1)
                try:
                    menu_item = MenuItem.objects.filter(name__icontains=item_name).first()
                    if menu_item:
                        order = None
                        # Find or create an order
                        if not current_order_state or not current_order_state.get('orderId'):
                            order = Order.objects.create(store=menu_item.store)
                        else:
                            try:
                                order = Order.objects.get(id=current_order_state['orderId'])
                                if order.store != menu_item.store:
                                    # For simplicity, create a new order if the store is different.
                                    # A better UX would be to ask the user for confirmation.
                                    order = Order.objects.create(store=menu_item.store)
                            except Order.DoesNotExist:
                                order = Order.objects.create(store=menu_item.store)

                        # Add item to the order
                        order_item, created = OrderItem.objects.get_or_create(
                            order=order,
                            menu_item=menu_item,
                            defaults={'quantity': quantity}
                        )
                        if not created:
                            order_item.quantity += quantity
                            order_item.save()

                        # Recalculate order state for the response
                        order_items = OrderItem.objects.filter(order=order)
                        items_data = []
                        total_price = 0
                        for item in order_items:
                            items_data.append({
                                'name': item.menu_item.name,
                                'quantity': item.quantity,
                                'price': float(item.menu_item.price)
                            })
                            total_price += item.menu_item.price * item.quantity

                        updated_order_state = {
                            'orderId': order.id,
                            'storeName': order.store.name,
                            'items': items_data,
                            'totalPrice': float(total_price),
                            'status': 'pending'
                        }
                        
                        reply = f"'{menu_item.name}' {quantity}개를 주문에 추가했습니다. 현재 주문 내역은 총 {int(total_price)}원입니다."
                        return Response({'reply': reply, 'currentOrder': updated_order_state, 'conversationState': conversation_state})
                    else:
                        reply = f"죄송하지만, '{item_name}' 메뉴를 찾을 수 없습니다."
                        return Response({'reply': reply, 'currentOrder': current_order_state, 'conversationState': conversation_state})

                except Exception as e:
                    reply = f"주문 처리 중 오류가 발생했습니다: {e}"
                    return Response({'reply': reply, 'currentOrder': current_order_state, 'conversationState': conversation_state, 'error': str(e)})

            # Intent: Finalize Order (e.g., "결제할게요")
            if actual_intent == 'finalize_order':
                if current_order_state and current_order_state.get('orderId') and current_order_state.get('totalPrice', 0) > 0:
                    try:
                        order = Order.objects.get(id=current_order_state['orderId'])
                        order.status = 'completed' # Mark order as completed in DB
                        order.save()

                        updated_order_state = {
                            'orderId': None, # Clear order from frontend after payment
                            'storeName': None,
                            'items': [],
                            'totalPrice': 0,
                            'status': 'completed' # Indicate payment completion
                        }
                        reply = f"총 {int(current_order_state['totalPrice'])}원 결제가 완료되었습니다. 감사합니다!"
                        conversation_state = {} # Reset conversation state
                        return Response({'reply': reply, 'currentOrder': updated_order_state, 'conversationState': conversation_state})
                    except Order.DoesNotExist:
                        reply = "현재 진행 중인 주문이 없습니다."
                        return Response({'reply': reply, 'currentOrder': current_order_state, 'conversationState': conversation_state})
                else:
                    reply = "결제할 주문이 없습니다."
                    return Response({'reply': reply, 'currentOrder': current_order_state, 'conversationState': conversation_state})


            # --- 4. Fallback to OpenAI for general queries ---
            openai.api_key = settings.OPENAI_API_KEY
            
            system_prompt = (
                "너는 AI 키오스크 '보이스오더'의 친절한 안내원이야. 너의 목표는 사용자가 DB에 있는 메뉴를 주문하도록 돕는 거야."
                "1. **DB 검색 결과 활용:** 사용자가 메뉴, 가게, 추천을 물어보면, 반드시 'DB 검색 결과' 섹션에 제공된 정보만을 사용해서 답변해야 해. 'DB 검색 결과'에 없는 것은 절대 언급하거나 제안해서는 안 돼."
                "2. **추천 요청 처리:** 사용자가 '추천해줘' 또는 '뭐 먹을까?' 같이 일반적인 요청을 하면, 'DB 검색 결과'에 있는 '주문 가능한 주요 음식 종류'를 먼저 알려주고, 사용자가 선택하게 해야 해. 예: '현재 주문 가능한 음식 종류는 버거, 김밥, 커피 등이 있어요. 어떤 종류로 추천해드릴까요?'"
                "3. **없는 메뉴 처리:** 사용자가 'DB 검색 결과'에 없는 메뉴나 음식 종류를 말하면, '죄송하지만, 요청하신 메뉴는 현재 제공되지 않아요. 대신 주문 가능한 [주요 음식 종류] 중에서 골라보시겠어요?'라고 정중하게 거절하고, 주문 가능한 옵션을 안내해야 해."
                "4. **대화 기억 및 명확한 안내:** 사용자와의 이전 대화를 기억해서, 대화가 끊기지 않고 자연스럽게 주문으로 이어지도록 해야 해. 가게 이름, 메뉴 이름, 가격을 명확하게 말해서 사용자가 혼동하지 않게 해야 해."
            )
            
            # Build DB search result for the AI prompt
            db_search_result = ""
            all_items = MenuItem.objects.all().select_related('store')
            
            # Find all available categories
            available_categories = set()
            for item in all_items:
                category = get_category_from_item(item.name)
                if category:
                    available_categories.add(category)

            # If the user asked for recommendation, set awaiting_category_selection
            if "메뉴 추천해주세요" in user_message or "뭐 먹을까" in user_message:
                conversation_state['awaiting_category_selection'] = True
                db_search_result = f"주문 가능한 주요 음식 종류: {', '.join(sorted(list(available_categories)))}"
            else:
                # A simple search logic for general queries
                q_objects = Q()
                if 'category' in entities:
                    q_objects |= Q(name__icontains=entities['category'])
                if 'store_name' in entities:
                    q_objects |= Q(store__name__icontains=entities['store_name'])
                
                if not q_objects:
                    q_objects |= Q(name__icontains=user_message) | Q(store__name__icontains=user_message)

                items_to_display = all_items.filter(q_objects).distinct()

                # Format the search result string
                stores_data = {}
                if items_to_display:
                    for item in items_to_display:
                        if item.store.name not in stores_data:
                            stores_data[item.store.name] = []
                        stores_data[item.store.name].append(f"{item.name}({int(item.price)}원)")
                
                result_texts = []
                if available_categories:
                    result_texts.append(f"주문 가능한 주요 음식 종류: {', '.join(sorted(list(available_categories)))}")

                if stores_data:
                    for store_name, items in sorted(stores_data.items()):
                        result_texts.append(f"'{store_name}' 메뉴: {', '.join(items)}")
                
                if result_texts:
                    db_search_result = " ".join(result_texts)
                else:
                    db_search_result = f"검색 결과 없음. 주문 가능한 주요 음식 종류는 {', '.join(sorted(list(available_categories)))}입니다."


            conversation_history = [{"role": "system", "content": system_prompt}]
            if db_search_result:
                conversation_history.append({"role": "system", "content": f"DB 검색 결과: {db_search_result}"})

            for message in history:
                role = "user" if message.get("sender") == "user" else "assistant"
                conversation_history.append({"role": role, "content": message.get("text")})
            
            conversation_history.append({"role": "user", "content": user_message})
            
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=conversation_history
            )
            
            ai_response = response.choices[0].message.content
            
            return Response({
                'reply': ai_response, 
                'currentOrder': current_order_state,
                'conversationState': conversation_state # Pass back the state
            })

        except json.JSONDecodeError:
            return Response({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Log the exception for debugging
            print(f"Error in ChatWithAIView: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# This view is now simplified and might be deprecated if all logic moves to ChatWithAIView
class ProcessCommandView(APIView):
    def post(self, request, *args, **kwargs):
        # This view can be used for simple, direct commands that don't require AI.
        # For now, we delegate most logic to ChatWithAIView.
        # This is a potential area for refactoring.
        message = request.data.get('message', '')
        current_order_state = request.data.get('currentState')
        
        # A very basic order command processor
        try:
            menu_item = MenuItem.objects.filter(name__icontains=message).first()
            if menu_item:
                order = None
                if not current_order_state or not current_order_state.get('orderId'):
                    order = Order.objects.create(store=menu_item.store)
                else:
                    try:
                        order = Order.objects.get(id=current_order_state['orderId'])
                        if order.store != menu_item.store:
                            # Handle ordering from a different store - for now, create a new order
                            order = Order.objects.create(store=menu_item.store)
                    except Order.DoesNotExist:
                        order = Order.objects.create(store=menu_item.store)

                order_item, created = OrderItem.objects.get_or_create(
                    order=order,
                    menu_item=menu_item,
                    defaults={'quantity': 1}
                )
                if not created:
                    order_item.quantity += 1
                    order_item.save()
                
                reply = f"{menu_item.name}을(를) 주문에 추가했습니다."
                
                # Recalculate order state
                order_items = OrderItem.objects.filter(order=order)
                items_data = [{'name': item.menu_item.name, 'quantity': item.quantity, 'price': float(item.menu_item.price)} for item in order_items]
                total_price = sum(item.menu_item.price * item.quantity for item in order_items)

                updated_order_state = {
                    'orderId': order.id,
                    'storeName': order.store.name,
                    'items': items_data,
                    'totalPrice': float(total_price),
                    'status': 'pending'
                }
                return Response({'reply': reply, 'currentOrder': updated_order_state})
            else:
                return Response({'reply': '메뉴를 찾지 못했습니다.', 'currentOrder': current_order_state})
        except Exception as e:
            return Response({'reply': f'오류 발생: {e}', 'currentOrder': current_order_state}, status=500)

        except json.JSONDecodeError:
            return Response({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Log the exception for debugging
            print(f"Error in ChatWithAIView: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# This view is now simplified and might be deprecated if all logic moves to ChatWithAIView
class ProcessCommandView(APIView):
    def post(self, request, *args, **kwargs):
        # This view can be used for simple, direct commands that don't require AI.
        # For now, we delegate most logic to ChatWithAIView.
        # This is a potential area for refactoring.
        message = request.data.get('message', '')
        current_order_state = request.data.get('currentState')
        
        # A very basic order command processor
        try:
            menu_item = MenuItem.objects.filter(name__icontains=message).first()
            if menu_item:
                order = None
                if not current_order_state or not current_order_state.get('orderId'):
                    order = Order.objects.create(store=menu_item.store)
                else:
                    try:
                        order = Order.objects.get(id=current_order_state['orderId'])
                        if order.store != menu_item.store:
                            # Handle ordering from a different store - for now, create a new order
                            order = Order.objects.create(store=menu_item.store)
                    except Order.DoesNotExist:
                        order = Order.objects.create(store=menu_item.store)

                order_item, created = OrderItem.objects.get_or_create(
                    order=order,
                    menu_item=menu_item,
                    defaults={'quantity': 1}
                )
                if not created:
                    order_item.quantity += 1
                    order_item.save()
                
                reply = f"{menu_item.name}을(를) 주문에 추가했습니다."
                
                # Recalculate order state
                order_items = OrderItem.objects.filter(order=order)
                items_data = [{'name': item.menu_item.name, 'quantity': item.quantity, 'price': float(item.menu_item.price)} for item in order_items]
                total_price = sum(item.menu_item.price * item.quantity for item in order_items)

                updated_order_state = {
                    'orderId': order.id,
                    'storeName': order.store.name,
                    'items': items_data,
                    'totalPrice': float(total_price),
                    'status': 'pending'
                }
                return Response({'reply': reply, 'currentOrder': updated_order_state})
            else:
                return Response({'reply': '메뉴를 찾지 못했습니다.', 'currentOrder': current_order_state})
        except Exception as e:
            return Response({'reply': f'오류 발생: {e}', 'currentOrder': current_order_state}, status=500)
