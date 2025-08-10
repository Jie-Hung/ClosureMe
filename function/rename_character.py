import requests

def rename_character(token, file_name, new_name):
    url = "http://localhost:3000/api/rename-character"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "fileName": file_name,
        "newName": new_name
    }

    res = requests.patch(url, json=payload, headers=headers)

    if res.status_code == 200:
        print("✅ 重新命名成功")
    else:
        print("❌ 重新命名失敗")
        print("🔻 狀態碼：", res.status_code)
        print("🔻 錯誤訊息：", res.text)
