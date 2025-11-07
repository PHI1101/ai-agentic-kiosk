from django.urls import path
from .views import ProcessCommandView, ChatWithAIView

urlpatterns = [
    path('process-command/', ProcessCommandView.as_view(), name='process-command'),
    path('chat/', ChatWithAIView.as_view(), name='chat-with-ai'),
]
