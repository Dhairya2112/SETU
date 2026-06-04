from rest_framework import serializers

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=True, max_length=150)
    password = serializers.CharField(required=True, write_only=True, min_length=8)

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

class RefreshSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=True)

class UserPreferencesSerializer(serializers.Serializer):
    llm_mode = serializers.ChoiceField(choices=["local", "cloud"], required=False)
    llm_model = serializers.CharField(required=False)
    tts_voice = serializers.CharField(required=False)
    tts_speed = serializers.FloatField(required=False)
    wake_word_sensitivity = serializers.FloatField(required=False)
    theme = serializers.ChoiceField(choices=["dark", "light"], required=False)
    language = serializers.CharField(required=False)

class UserPermissionsSerializer(serializers.Serializer):
    level_2_granted = serializers.BooleanField(required=False)
    level_3_tools = serializers.ListField(child=serializers.CharField(), required=False)

class UserSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    email = serializers.EmailField()
    username = serializers.CharField()
    created_at = serializers.DateTimeField()
    preferences = UserPreferencesSerializer()
    permissions = UserPermissionsSerializer()
