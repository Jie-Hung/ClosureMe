from function.register import register
from function.login import login
from function.upload_character import upload_character
from function.download_character import download_character
from function.get_files_list import get_file_list
from function.delete_character import delete_character
from function.rename_character import rename_character

token = None  

def main():
    global token
    while True:
        print("\n--- 功能選單 ---")
        print("1. 註冊")
        print("2. 登入")
        print("3. 上傳角色資訊")
        print("4. 下載角色資訊")
        print("5. 取得檔案清單")
        print("6. 刪除角色")
        print("7. 修改角色名稱")
        print("0. 離開")
        choice = input("請輸入選項編號：")

        if choice == "1":
            username = input("請輸入帳號：")
            email = input("請輸入信箱：")
            password = input("請輸入密碼：")
            register(username, email, password)

        elif choice == "2":
            identifier = input("請輸入帳號或信箱：")
            password = input("請輸入密碼：")
            token = login(identifier, password)

        elif choice == "3":
            if not token:
                print("⚠️  需先登入才能上傳")
                continue
            image_path = input("圖片路徑：").strip().strip('"')
            appearance = input("外觀描述：").strip()
            memory = input("記憶描述：").strip()
            filename = input("檔名：").strip()

            upload_character(token, image_path, appearance, memory, filename)

        elif choice == "4":
            if not token:
                print("⚠️  需先登入才能下載")
                continue

            filename = input("請輸入角色名稱：").strip()
            print("選擇下載項目：1. 圖片 2. 外觀 3. 記憶 4. 全部")
            download_option = input("請輸入數字：").strip()

            option_map = {
                "1": "image",
                "2": "appearance",
                "3": "memory",
                "4": "all"
            }

            if download_option not in option_map:
                print("❌ 無效選項，請輸入 1、2、3 或 4")
                continue

            download_type = option_map[download_option]
            download_character(token, filename, download_type)

        elif choice == "5":
            if not token:
                print("⚠️  需先登入才能查看檔案列表")
                continue
            get_file_list(token)

        elif choice == "6":
            if not token:
                print("⚠️  需先登入才能刪除")
                continue
            file_name = input("請輸入要刪除的角色名稱：").strip()
            confirm = input(f"⚠️  確定要刪除角色「{file_name}」嗎？(y/n)：").lower()
            if confirm == "y":
                delete_character(token, file_name)
            else:
                print("🟡 已取消刪除操作")

        elif choice == "7":
            if not token:
                print("⚠️  需先登入才能修改")  
                continue
            file_name = input("請輸入原本的角色名稱：").strip()
            new_name = input("請輸入新的角色名稱：").strip()
            rename_character(token, file_name, new_name)

        elif choice == "0":
            print("👋 程式結束")
            break

        else:
            print("⚠️  無效選項，請重新輸入")

if __name__ == "__main__":
    main()

