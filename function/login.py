import requests

def login(identifier, password):
    res = requests.post("https://closureme.onrender.com/api/login", json={
        "identifier": identifier,
        "password": password
    })

    if res.status_code == 200:
        data = res.json()
        token = data["token"]
        user = data["user"]

        print("✅ 登入成功")
        print("🔐 Token：", token)
        print("👤 使用者資訊：", user)
        return token
    else:
        print("❌ 登入失敗")
        print(res.text)
        return None
