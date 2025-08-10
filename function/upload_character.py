import requests

def upload_character(token, image_path, appearance, memory, filename):
    url = "http://localhost:3000/api/upload-character"
    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        with open(image_path, "rb") as f:
            files = {"file": f}
            data = {
                "appearance": appearance,
                "memory": memory,
                "filename": filename
            }

            res = requests.post(url, headers=headers, files=files, data=data)

            if res.status_code == 200:
                print("✅ 上傳成功")
                print("📄 上傳資訊：", res.json())
            else:
                try:
                    error_info = res.json()
                    message = error_info.get("message", "")
                    print(f"❌ 上傳失敗：{message or '無錯誤說明'}")
                except ValueError:
                    print(f"❌ 上傳失敗（HTTP {res.status_code}）")
                    print("🔻 錯誤內容：", res.text)

    except FileNotFoundError:
        print(f"❌ 找不到檔案：{image_path}")
        print("👉 請確認檔案路徑是否正確、檔名與副檔名拼寫是否有誤")



