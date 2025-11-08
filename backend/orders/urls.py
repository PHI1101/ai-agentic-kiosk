from django.urls import path
from .views import ChatWithAIView

urlpatterns = [
    path('chat/', ChatWithAIView.as_view(), name='chat-with-ai'),
]
