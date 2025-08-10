import requests

def register(username, email, password):
    res = requests.post("http://localhost:3000/api/register", json={
        "username": username,
        "email": email,
        "password": password
    })

    if res.status_code == 201:
        data = res.json()
        user = data.get("user", {})

        print("✅ 註冊成功")
        print("👤 使用者資訊：", user)
        return user
    else:
        print("❌ 註冊失敗")
        print(res.text)
        return None

