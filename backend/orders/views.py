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
            system_prompt = "너는 노인과 장애인도 쉽게 사용할 수 있는 AI 키오스크야. 주문이 완료될 때까지 대화를 이어가며 친절하게 돕고, 중간에 끊기지 않도록 이전 대화를 기억해. 사용자가 메뉴를 물어보면, 아래 'DB 검색 결과'를 바탕으로 구체적인 가게와 메뉴, 가격을 안내해야 해."
            
            # DB 검색 로직
            db_search_result = ""
            search_keywords = ['메뉴', '뭐 팔아', '있어', '추천', '버거', '커피', '김밥'] # 확장 가능한 키워드
            
            # 사용자가 음식이나 메뉴 관련 질문을 하는지 간단히 확인
            if any(keyword in user_message for keyword in search_keywords):
                # 간단한 키워드 기반 검색 실행 (예: '버거', '커피')
                query = user_message.split(' ')[0] # "햄버거 보여줘" -> "햄버거"
                if '버거' in query or '햄버거' in query:
                    query = '버거'
                
                menu_items = MenuItem.objects.filter(name__icontains=query)
                
                if menu_items.exists():
                    stores = {}
                    for item in menu_items:
                        if item.store.name not in stores:
                            stores[item.store.name] = []
                        stores[item.store.name].append(f"{item.name}({int(item.price)}원)")
                    
                    result_texts = []
                    for store_name, items in stores.items():
                        result_texts.append(f"'{store_name}'에는 {', '.join(items)}가(이) 있어.")
                    db_search_result = " ".join(result_texts)

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
