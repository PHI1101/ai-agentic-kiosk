from django.urls import path
from .views import ProcessCommandView

urlpatterns = [
    path('process-command/', ProcessCommandView.as_view(), name='process-command'),
]
