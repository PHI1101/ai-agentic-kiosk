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

# For simplicity, we'll use a mock NLU
def simple_nlu(text):
    if '김밥' in text and '주문' in text:
        return {'intent': 'order_food', 'item': '김밥'}
    return {'intent': 'unknown'}

class ProcessCommandView(APIView):
    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '')
        current_order_state = request.data.get('currentState')

        nlu_result = simple_nlu(message)

        reply = "죄송합니다. 무슨 말씀이신지 잘 모르겠어요."
        updated_order_state = current_order_state

        if nlu_result['intent'] == 'order_food':
            item_name = nlu_result['item']
            # For now, let's assume there is only one store and find the item
            try:
                menu_item = MenuItem.objects.filter(name__icontains=item_name).first()
                if menu_item:
                    # Create a new order if one doesn't exist
                    if not current_order_state or current_order_state['status'] != 'pending':
                        store = menu_item.store
                        order = Order.objects.create(store=store)
                        updated_order_state = {
                            'orderId': order.id,
                            'storeName': store.name,
                            'items': [],
                            'totalPrice': 0,
                            'status': 'pending'
                        }
                    else:
                        order = Order.objects.get(id=current_order_state['orderId'])

                    # Add item to order
                    order_item, created = OrderItem.objects.get_or_create(
                        order=order, 
                        menu_item=menu_item, 
                        defaults={'quantity': 1}
                    )
                    if not created:
                        order_item.quantity += 1
                        order_item.save()
                    
                    reply = f"{item_name}을(를) 주문에 추가했습니다."
                    
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

                    updated_order_state['items'] = items_data
                    updated_order_state['totalPrice'] = float(total_price)

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

            if not user_message:
                return JsonResponse({'error': 'Message not provided'}, status=400)

            openai.api_key = settings.OPENAI_API_KEY

            # 시스템 프롬프트 설정
            system_prompt = (
                "너는 노인과 장애인도 쉽게 사용할 수 있는 AI 키오스크야. "
                "주문이 완료될 때까지 대화를 이어가며 친절하게 돕고, 중간에 끊기지 않도록 이전 대화를 기억해. "
                "사용자가 메뉴, 가게, 추천 등을 물어보면, 아래 'DB 검색 결과'를 **반드시 참고하여** 구체적인 가게와 메뉴, 가격을 안내해야 해. "
                "**DB 검색 결과에 없는 내용은 절대 지어내지 마.** "
                "만약 DB 검색 결과가 비어있다면, '죄송하지만 현재 요청하신 정보와 일치하는 가게나 메뉴를 찾을 수 없습니다.'라고 답변해줘."
            )
            
            # DB 검색 로직
            db_search_result = ""
            
            # Keywords that trigger a DB search for menu/store information
            menu_related_keywords = ['메뉴', '뭐 팔아', '있어', '추천', '음식점', '가게', '근처', '어떤', '종류', '보여줘']
            food_keywords = ['버거', '햄버거', '커피', '김밥', '마라탕', '분식', '한식', '양식', '카페', '스무디', '베이글', '크로와상', '샌드위치', '과일'] # Specific food types

            should_search_db = False
            search_query = ""

            # Check if user message contains any menu-related keywords
            if any(keyword in user_message for keyword in menu_related_keywords):
                should_search_db = True
                # Try to extract a specific food type if mentioned
                for food_type in food_keywords:
                    if food_type in user_message:
                        search_query = food_type
                        break
                # If no specific food type, but general menu/recommendation, search broadly
                if not search_query and any(k in user_message for k in ['추천', '근처', '어떤', '종류', '뭐 팔아', '메뉴']):
                    search_query = "all" # Special query to fetch all stores/menus

            # If a specific food type is mentioned directly without general menu keywords
            elif any(food_type in user_message for food_type in food_keywords):
                should_search_db = True
                for food_type in food_keywords:
                    if food_type in user_message:
                        search_query = food_type
                        break

            if should_search_db:
                stores_data = {}
                if search_query == "all":
                    # Fetch all stores and their menu items
                    all_stores = Store.objects.all()
                    for store in all_stores:
                        stores_data[store.name] = []
                        for item in store.menu_items.all():
                            stores_data[store.name].append(f"{item.name}({int(item.price)}원)")
                elif search_query:
                    # Search for menu items containing the query
                    menu_items = MenuItem.objects.filter(name__icontains=search_query)
                    for item in menu_items:
                        if item.store.name not in stores_data:
                            stores_data[item.store.name] = []
                        stores_data[item.store.name].append(f"{item.name}({int(item.price)}원)")
                
                if stores_data:
                    result_texts = []
                    for store_name, items in stores_data.items():
                        if items: # Only add if store has matching items
                            result_texts.append(f"'{store_name}'에는 {', '.join(items)}가(이) 있습니다.")
                        # else: # If search_query was specific and store has no matching items, don't add empty store
                        #     result_texts.append(f"'{store_name}'에는 현재 '{search_query}' 관련 메뉴가 없습니다.")
                    db_search_result = " ".join(result_texts)
                else:
                    db_search_result = "현재 데이터베이스에 요청하신 정보와 일치하는 가게나 메뉴가 없습니다."


            # 대화 기록을 OpenAI 형식으로 변환
            conversation_history = [{"role": "system", "content": system_prompt}]

            # DB 검색 결과가 있으면 시스템 메시지에 추가
            if db_search_result:
                conversation_history.append({"role": "system", "content": f"DB 검색 결과: {db_search_result}"})

            for message in history:
                role = "user" if message.get("sender") == "user" else "assistant"
                conversation_history.append({"role": role, "content": message.get("text")})
            
            # 현재 사용자 메시지 추가
            conversation_history.append({"role": "user", "content": user_message})
            
            # OpenAI API 호출
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=conversation_history
            )
            
            ai_response = response.choices[0].message.content
            
            return JsonResponse({'reply': ai_response})

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
