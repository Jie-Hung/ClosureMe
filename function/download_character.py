import os
import requests

def get_downloads_folder():
    """取得使用者下載資料夾路徑（跨平台支援）"""
    if os.name == "nt":
        return os.path.join(os.environ["USERPROFILE"], "Downloads")
    else:
        return os.path.join(os.path.expanduser("~"), "Downloads")

def download_file(file_url, filename):
    """下載單一檔案並儲存至下載資料夾"""
    save_dir = get_downloads_folder()
    save_path = os.path.join(save_dir, filename)

    try:
        res = requests.get(file_url)

        if res.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(res.content)
            print(f"✅ 下載成功：{save_path}")
        else:
            try:
                error_info = res.json()
                message = error_info.get("message", "")
                print(f"❌ 檔案下載失敗：{message or '無錯誤說明'}")
            except ValueError:
                print(f"❌ 檔案下載失敗（HTTP {res.status_code}）")

            print(f"🔻 URL：{file_url}")
            print(f"🗂 儲存路徑（預定）：{save_path}")

    except Exception as e:
        print(f"❌ 發生例外錯誤：{e}")
        print(f"🔻 URL：{file_url}")


def download_character(token, filename, download_type="all"):
    candidate_extensions = ["", ".png", ".jpg"]
    query_filename = None
    last_response = None  

    for ext in candidate_extensions:
        trial_name = filename if ext == "" else filename + ext
        url = "http://localhost:3000/api/download-character"
        headers = {
            "Authorization": f"Bearer {token}"
        }
        params = {"fileName": trial_name}

        res = requests.get(url, headers=headers, params=params)
        last_response = res

        if res.status_code == 200:
            query_filename = trial_name
            break

    if not query_filename:
        try:
            error_info = last_response.json()
            error_message = error_info.get("message", f"HTTP {last_response.status_code}")
        except Exception:
            error_message = f"HTTP {last_response.status_code}"

        print(f"❌ 下載失敗：{error_message}")
        return

    result = last_response.json()["data"]
    base_url = "http://localhost:3000"

    # 圖片
    if download_type in ["image", "all"]:
        if result["imagePath"]:
            ext = os.path.splitext(result["imagePath"])[1]
            image_url = base_url + result["imagePath"]
            download_file(image_url, f"{filename}{ext}")
        else:
            print("⚠️ 找不到圖片路徑")

    # 外觀描述
    if download_type in ["appearance", "all"]:
        if result["appearancePath"]:
            appearance_url = base_url + result["appearancePath"]
            download_file(appearance_url, f"{filename}_appearance.txt")
        else:
            print("⚠️ 找不到外觀描述")

    # 記憶描述
    if download_type in ["memory", "all"]:
        if result["memoryPath"]:
            memory_url = base_url + result["memoryPath"]
            download_file(memory_url, f"{filename}_memory.txt")
        else:
            print("⚠️ 找不到記憶描述")

