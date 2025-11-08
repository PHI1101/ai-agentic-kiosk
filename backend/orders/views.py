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

def _update_order(item_name, current_order_state):
    """
    Adds a specified item to the order or creates a new order.
    Returns the updated order state.
    """
    menu_item = MenuItem.objects.filter(name__iexact=item_name).first()
    if not menu_item:
        # This should not happen if AI is working correctly
        return None, "죄송합니다. 해당 메뉴를 찾을 수 없습니다."

    order = None
    order_id = current_order_state.get('orderId')

    if order_id:
        try:
            order = Order.objects.get(id=order_id)
            # If the new item is from a different store, create a new order
            if order.store != menu_item.store:
                order = Order.objects.create(store=menu_item.store)
        except Order.DoesNotExist:
            order = Order.objects.create(store=menu_item.store)
    else:
        order = Order.objects.create(store=menu_item.store)

    order_item, created = OrderItem.objects.get_or_create(
        order=order,
        menu_item=menu_item,
        defaults={'quantity': 1}
    )
    if not created:
        order_item.quantity += 1
        order_item.save()

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
    return updated_order_state, f"{menu_item.name}을(를) 장바구니에 추가했습니다."


def simple_nlu(text, conversation_state=None):
    """
    A simple Natural Language Understanding function to detect user intent and entities.
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
    # Let the AI handle confirmations based on context
    confirmation_keywords = ['네', '응', '예', '맞아', '좋아', '그렇게', '주문할게', '주문해줘']
    if any(kw in text for kw in confirmation_keywords):
        intent['intent'] = 'general_query' # Let AI figure out confirmation context
        return intent

    finalization_keywords = ['포장이요', '배달이요', '주문 완료', '결제', '계산', '돈 낼게']
    if any(kw in text for kw in finalization_keywords):
        intent['intent'] = 'finalize_order'
        return intent

    menu_query_keywords = ['메뉴', '뭐 팔아', '메뉴판', '뭐 있어']
    if 'store_name' in intent['entities'] and any(kw in text for kw in menu_query_keywords):
        intent['intent'] = 'list_menu_by_store'
        return intent
        
    if 'store_name' in intent['entities'] and conversation_state and conversation_state.get('presented_stores'):
        if intent['entities']['store_name'] in conversation_state['presented_stores']:
            intent['intent'] = 'list_menu_by_store'
            return intent

    store_query_keywords = ['가게', '어디', '파는 곳', '매장']
    if 'category' in intent['entities'] and any(kw in text for kw in store_query_keywords):
        intent['intent'] = 'find_stores_by_category'
        return intent

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

            nlu_result = simple_nlu(user_message, conversation_state)
            intent = nlu_result['intent']
            entities = nlu_result['entities']

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
                    conversation_state = {}
                return Response({'reply': reply, 'currentOrder': current_order_state, 'conversationState': conversation_state})

            if intent == 'list_menu_by_store':
                store_name = entities['store_name']
                menu_items = MenuItem.objects.filter(store__name__iexact=store_name)
                if menu_items:
                    menu_list = [f"{item.name}({int(item.price)}원)" for item in menu_items]
                    reply = f"'{store_name}'의 메뉴는 {', '.join(menu_list)}입니다. 무엇을 주문하시겠어요?"
                else:
                    reply = f"죄송하지만 '{store_name}'의 메뉴 정보를 찾을 수 없습니다."
                conversation_state = {}
                return Response({'reply': reply, 'currentOrder': current_order_state, 'conversationState': conversation_state})

            # --- Fallback to OpenAI for general queries and confirmations ---
            openai.api_key = settings.OPENAI_API_KEY
            
            system_prompt = (
                "너는 AI 키오스크 '보이스오더'의 친절한 안내원이야. 너의 목표는 사용자가 DB에 있는 메뉴를 주문하도록 돕는 거야."
                "1. **DB 검색 결과 활용:** 사용자가 메뉴, 가게, 추천을 물어보면, 반드시 'DB 검색 결과' 섹션에 제공된 정보만을 사용해서 답변해야 해. 'DB 검색 결과'에 없는 것은 절대 언급하거나 제안해서는 안 돼."
                "2. **주문 확정 및 실행:** 사용자가 특정 메뉴 주문을 요청하거나, '주문할게', '네' 등으로 주문을 확정하면, 반드시 다음 JSON 형식에 맞춰 응답해야 해. JSON 블록은 대화의 가장 마지막에 와야 해."
                '```json\n'
                '{\n'
                '  "action": "add_to_cart",\n'
                '  "item_name": "메뉴이름",\n'
                '  "reply": "장바구니에 추가했습니다. 추가로 필요하신 거 있으세요?"\n'
                '}\n'
                '```\n'
                "   - `item_name`에는 'DB 검색 결과'에 명시된 메뉴의 정확한 전체 이름을 사용해야 해. '커피'나 '버거' 같은 카테고리 이름이 아니라 '아메리카노 (ICE)'나 '싸이버거' 같은 구체적인 전체 이름을 사용해야만 해. 사용자가 모호하게 말하면, 주문을 실행하기 전에 명확한 메뉴를 다시 물어봐줘."
                "   - `reply`에는 사용자에게 보여줄 자연스러운 확인 메시지를 담아줘."
                "3. **일반 대화:** 주문과 관련 없는 일반 대화나, JSON 행동이 필요 없는 경우에는 JSON 블록 없이 자유롭게 답변해."
                "4. **명확한 안내:** 가게 이름, 메뉴 이름, 가격을 명확하게 말해서 사용자가 혼동하지 않게 해야 해."
            )
            
            db_search_result = ""
            all_items = MenuItem.objects.all().select_related('store')
            available_categories = sorted(list(set(c for c in [get_category_from_item(item.name) for item in all_items] if c)))

            q_objects = Q()
            if 'category' in entities: q_objects |= Q(name__icontains=entities['category'])
            if 'store_name' in entities: q_objects |= Q(store__name__icontains=entities['store_name'])
            if not q_objects: q_objects |= Q(name__icontains=user_message) | Q(store__name__icontains=user_message)

            items_to_display = all_items.filter(q_objects).distinct()
            stores_data = {}
            if items_to_display:
                for item in items_to_display:
                    if item.store.name not in stores_data: stores_data[item.store.name] = []
                    stores_data[item.store.name].append(f"{item.name}({int(item.price)}원)")
            
            result_texts = [f"주문 가능한 주요 음식 종류: {', '.join(available_categories)}"]
            if stores_data:
                for store_name, items in sorted(stores_data.items()):
                    result_texts.append(f"'{store_name}' 메뉴: {', '.join(items)}")
            
            db_search_result = " ".join(result_texts)

            conversation_history = [{"role": "system", "content": system_prompt}]
            if db_search_result:
                conversation_history.append({"role": "system", "content": f"DB 검색 결과: {db_search_result}"})

            for message in history:
                conversation_history.append({"role": "user" if message.get("sender") == "user" else "assistant", "content": message.get("text")})
            conversation_history.append({"role": "user", "content": user_message})
            
            response = openai.chat.completions.create(model="gpt-4o", messages=conversation_history)
            ai_response_text = response.choices[0].message.content

            final_reply = ai_response_text
            updated_order = current_order_state

            # Check for JSON action block
            json_match = re.search(r'```json\n({.*?})\n```', ai_response_text, re.DOTALL)
            if json_match:
                action_json_str = json_match.group(1)
                try:
                    action_data = json.loads(action_json_str)
                    final_reply = action_data.get('reply', "주문이 처리되었습니다.") # Use reply from JSON
                    
                    if action_data.get('action') == 'add_to_cart':
                        item_name = action_data.get('item_name')
                        if item_name:
                            updated_order, _ = _update_order(item_name, current_order_state)
                            if not updated_order: # Handle case where item is not found
                                final_reply = "죄송합니다. 해당 메뉴를 찾을 수 없어 주문에 실패했습니다."
                                updated_order = current_order_state
                except json.JSONDecodeError:
                    # If JSON is malformed, just use the full text as reply
                    final_reply = ai_response_text

            return Response({
                'reply': final_reply, 
                'currentOrder': updated_order,
                'conversationState': conversation_state
            })

        except Exception as e:
            print(f"Error in ChatWithAIView: {e}") # Log error for debugging
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)