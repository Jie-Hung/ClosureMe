import requests

def get_file_list(token):
    url = "http://localhost:3000/api/files"
    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        res = requests.get(url, headers=headers)

        if res.status_code == 200:
            files = res.json()
            if not files:
                print("📭 尚無檔案記錄")
                return

            print("📋 檔案列表：")
            for f in files:
                print(f"📌 ID: {f['image_id']}, 名稱: {f['file_name']}, 上傳時間: {f['uploaded_at']}")
                print(f"  ├ 圖片路徑：{f['image_path']}")
                print(f"  ├ 外觀描述：{f['appearance_path']}")
                print(f"  └ 記憶描述：{f['memory_path']}\n")
        else:
            try:
                error_info = res.json()
                message = error_info.get("message", "")
                print(f"❌ 無法取得檔案列表：{message or '無錯誤說明'}")
            except ValueError:
                print(f"❌ 無法取得檔案列表（HTTP {res.status_code}）")
                print("🔻 錯誤內容：", res.text)

    except Exception as e:
        print("❌ 發生例外錯誤：", e)
