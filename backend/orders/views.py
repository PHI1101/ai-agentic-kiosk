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
