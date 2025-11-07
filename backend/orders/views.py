from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Store, MenuItem, Order, OrderItem
import openai
from django.conf import settings
from django.http import JsonResponse
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

def simple_nlu(text, history=None):
    """A simple Natural Language Understanding function to detect user intent."""
    intent = {'intent': 'unknown', 'item': None, 'quantity': 1}
    
    # Keywords for direct order intent
    order_keywords = ['주문할게요', '주문할래', '주문해주세요', '주문이요', '주문']
    
    # 1. Check for direct order intent in the current message
    for keyword in order_keywords:
        if keyword in text:
            parts = text.split(keyword)
            item_candidate = parts[0].strip()
            if item_candidate and MenuItem.objects.filter(name__icontains=item_candidate).exists():
                intent['item'] = item_candidate
                intent['intent'] = 'order_food'
                return intent
            # If no item is found before the keyword, check history
            if history:
                # Check if the last AI message was a confirmation question
                last_assistant_message = next((msg.get('text') for msg in reversed(history) if msg.get('sender') == 'assistant'), None)
                if last_assistant_message and '주문하실 건가요?' in last_assistant_message:
                    match = re.search(r"(\S+)의 (\S+)는 (\d+)원이에요\\. 주문하실 건가요\\?", last_assistant_message)
                    if match:
                        intent['item'] = match.group(2)
                        intent['intent'] = 'order_food'
                        return intent
    
    # 2. Check for confirmation (e.g., "yes") after a confirmation question
    confirmation_keywords = ['네', '응', '예', '네 맞아요', '네 그렇게 해주세요']
    if any(keyword in text for keyword in confirmation_keywords) and history:
        last_assistant_message = next((msg.get('text') for msg in reversed(history) if msg.get('sender') == 'assistant'), None)
        if last_assistant_message and '주문하실 건가요?' in last_assistant_message:
            match = re.search(r"(\S+)의 (\S+)는 (\d+)원이에요\\. 주문하실 건가요\\?", last_assistant_message)
            if match:
                intent['item'] = match.group(2)
                intent['intent'] = 'order_food'
                return intent

    # 3. If user just says a menu item name, assume order intent
    if not intent['item']:
        # Exact match first
        menu_item = MenuItem.objects.filter(name__iexact=text).first()
        if not menu_item:
            # Then partial match
            menu_item = MenuItem.objects.filter(name__icontains=text).first()
        
        if menu_item:
            intent['item'] = menu_item.name
            intent['intent'] = 'order_food'
            return intent

    return intent

# --- API Views ---

class ProcessCommandView(APIView):
    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '')
        current_order_state = request.data.get('currentState')

        nlu_result = simple_nlu(message)

        reply = "죄송합니다. 무슨 말씀이신지 잘 모르겠어요."
        updated_order_state = current_order_state

        if nlu_result['intent'] == 'order_food':
            item_name = nlu_result['item']
            try:
                menu_item = MenuItem.objects.filter(name__icontains=item_name).first()
                if menu_item:
                    order = None
                    if not current_order_state or not current_order_state.get('orderId'):
                        store = menu_item.store
                        order = Order.objects.create(store=store)
                    else:
                        try:
                            order = Order.objects.get(id=current_order_state['orderId'])
                            if order.store != menu_item.store:
                                store = menu_item.store
                                order = Order.objects.create(store=store)
                        except Order.DoesNotExist:
                            store = menu_item.store
                            order = Order.objects.create(store=store)

                    order_item, created = OrderItem.objects.get_or_create(
                        order=order,
                        menu_item=menu_item,
                        defaults={'quantity': 1}
                    )
                    if not created:
                        order_item.quantity += 1
                        order_item.save()
                    
                    reply = f"{item_name}을(를) 주문에 추가했습니다."
                    
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
                print(f"ProcessCommandView updated_order_state: {updated_order_state}")
                else:
                    reply = f"죄송하지만, '{item_name}' 메뉴를 찾을 수 없습니다."

            except Exception as e:
                reply = f"주문 처리 중 오류가 발생했습니다: {e}"

        return Response({'reply': reply, 'currentOrder': updated_order_state}, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class ChatWithAIView(APIView):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            history = data.get('history', [])
            user_message = data.get('message')
            current_order_state = data.get('currentState')

            if not user_message:
                return JsonResponse({'error': 'Message not provided'}, status=400)

            openai.api_key = settings.OPENAI_API_KEY

            # --- Order Intent Detection and Processing ---
            nlu_result = simple_nlu(user_message, history)
            updated_order_state = current_order_state

            if nlu_result['intent'] == 'order_food' and nlu_result['item']:
                item_name = nlu_result['item']
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
                            defaults={'quantity': nlu_result['quantity']}
                        )
                        if not created:
                            order_item.quantity += nlu_result['quantity']
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
                        print(f"ChatWithAIView updated_order_state: {updated_order_state}")
                        
                        reply = f"'{menu_item.name}' {nlu_result['quantity']}개를 주문에 추가했습니다. 현재 주문 내역은 총 {int(total_price)}원입니다."
                        return JsonResponse({'reply': reply, 'currentOrder': updated_order_state})
                    else:
                        reply = f"죄송하지만, '{item_name}' 메뉴를 찾을 수 없습니다."
                        return JsonResponse({'reply': reply, 'currentOrder': current_order_state})

                except Exception as e:
                    reply = f"주문 처리 중 오류가 발생했습니다: {e}"
                    return JsonResponse({'reply': reply, 'currentOrder': current_order_state, 'error': str(e)})

            # --- General Chat Logic (if no order intent detected) ---
            system_prompt = (
                "너는 AI 키오스크의 친절한 안내원이야. 너의 최우선 목표는 사용자가 DB에 있는 메뉴를 주문하도록 돕는 거야."
                "1. **DB 검색 결과 활용:** 사용자가 메뉴, 가게, 추천을 물어보면, 반드시 'DB 검색 결과' 섹션에 제공된 정보만을 사용해서 답변해야 해. 'DB 검색 결과'에 없는 가게, 메뉴, 음식 종류(예: 양식, 아시아 음식)는 절대 언급하거나 제안해서는 안 돼."
                "2. **추천 요청 처리:** 사용자가 '추천해줘' 또는 '뭐 먹을까?' 같이 일반적인 요청을 하면, 'DB 검색 결과'에 있는 '주문 가능한 주요 음식 종류'를 먼저 알려주고, 사용자가 선택하게 해야 해. 예를 들어, '현재 주문 가능한 음식 종류는 버거, 김밥, 커피 등이 있어요. 어떤 종류로 추천해드릴까요?'와 같이 안내해."
                "3. **없는 메뉴 처리:** 사용자가 'DB 검색 결과'에 없는 메뉴나 음식 종류를 말하면, '죄송하지만, 요청하신 메뉴는 현재 제공되지 않아요. 대신 주문 가능한 [주요 음식 종류] 중에서 골라보시겠어요?'라고 정중하게 거절하고, 주문 가능한 옵션을 안내해야 해."
                "4. **대화 기억:** 사용자와의 이전 대화를 기억해서, 대화가 끊기지 않고 자연스럽게 주문으로 이어지도록 해야 해."
                "5. **명확한 안내:** 가게 이름, 메뉴 이름, 가격을 명확하게 말해서 사용자가 혼동하지 않게 해야 해."
            )
            
            db_search_result = ""
            menu_related_keywords = ['메뉴', '뭐 팔아', '있어', '추천', '음식점', '가게', '근처', '어떤', '종류', '보여줘', '배고파', '먹을 거']
            food_keywords = ['버거', '커피', '김밥', '마라', '분식', '토스트', '라면', '떡볶이', '음료']

            should_search_db = False
            search_query = ""

            if any(keyword in user_message for keyword in ['배고파', '먹을 거', '추천', '뭐 먹지', '있어?']):
                should_search_db = True
                search_query = "all"

            if not should_search_db:
                if any(keyword in user_message for keyword in menu_related_keywords):
                    should_search_db = True
                    for food_type in food_keywords:
                        if food_type in user_message:
                            search_query = food_type
                            break
                    if not search_query:
                        search_query = "all"
                elif any(food_type in user_message for food_type in food_keywords):
                    should_search_db = True
                    for food_type in food_keywords:
                        if food_type in user_message:
                            search_query = food_type
                            break
            
            if should_search_db:
                stores_data = {}
                available_categories = set()
                
                all_items = MenuItem.objects.all().select_related('store')

                for item in all_items:
                    category = get_category_from_item(item.name)
                    if category:
                        available_categories.add(category)

                items_to_display = []
                if search_query and search_query != "all":
                    for item in all_items:
                        item_category = get_category_from_item(item.name)
                        if (
                            (search_query in item.name.lower()) or
                            (item_category and search_query in item_category) or
                            (search_query in item.store.name.lower())
                        ):
                            items_to_display.append(item)
                else:
                    items_to_display = all_items

                for item in items_to_display:
                    if item.store.name not in stores_data:
                        stores_data[item.store.name] = []
                    stores_data[item.store.name].append(f"{item.name}({int(item.price)}원)")

                if stores_data:
                    result_texts = []
                    if search_query == "all" and available_categories:
                        result_texts.append(f"현재 주문 가능한 주요 음식 종류는 {', '.join(sorted(list(available_categories)))} 등입니다.")

                    for store_name, items in sorted(stores_data.items()):
                        if items:
                            result_texts.append(f"'{store_name}'에는 {', '.join(items)}가(이) 있습니다.")
                    
                    db_search_result = " ".join(result_texts)
                else:
                    if search_query and search_query != "all":
                        db_search_result = f"죄송하지만, 요청하신 '{search_query}' 관련 메뉴를 찾을 수 없습니다. 현재 주문 가능한 종류는 {', '.join(sorted(list(available_categories)))}입니다."
                    else:
                        db_search_result = "현재 데이터베이스에 메뉴 정보가 없습니다."

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
            
            return JsonResponse({'reply': ai_response, 'currentOrder': updated_order_state})

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)