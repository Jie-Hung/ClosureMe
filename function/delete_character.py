import requests

def delete_character(token, file_name):
    url = "http://localhost:3000/api/delete-character"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "fileName": file_name
    }

    try:
        res = requests.delete(url, headers=headers, json=data)
        if res.status_code == 200:
            print(f"✅ {file_name} 已成功刪除")
        else:
            print("❌ 刪除失敗")
            print("🔻 狀態碼：", res.status_code)
            print("🔻 錯誤訊息：", res.text)
    except Exception as e:
        print(f"❌ 發生例外錯誤：{e}")
