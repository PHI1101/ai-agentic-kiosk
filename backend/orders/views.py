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

            # 대화 기록을 OpenAI 형식으로 변환
            conversation_history = [
                {"role": "system", "content": "너는 노인과 장애인도 쉽게 사용할 수 있는 AI 키오스크야. 주문이 완료될 때까지 대화를 이어가며 친절하게 돕고, 중간에 끊기지 않도록 이전 대화를 기억해."}
            ]

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
