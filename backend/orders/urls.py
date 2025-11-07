from django.urls import path, re_path
from .views import ProcessCommandView, ChatWithAIView

urlpatterns = [
    re_path(r'^process-command/?$', ProcessCommandView.as_view(), name='process-command'),
    re_path(r'^chat/?$', ChatWithAIView.as_view(), name='chat-with-ai'),
]