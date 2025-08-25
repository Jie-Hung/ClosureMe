import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

with open("config.json", "r") as f:
    fbx_dir = json.load(f)["fbx_upload_dir"]

os.makedirs(fbx_dir, exist_ok=True)

s3 = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)

for file in os.listdir(fbx_dir):
    if file.endswith(".fbx"):
        local_path = os.path.join(fbx_dir, file)
        s3_key = f"fbx/temp/{file.replace('.fbx', '_init.fbx')}"
        try:
            s3.upload_file(local_path, AWS_S3_BUCKET, s3_key)
            print(f"✅ 已上傳至 S3：{s3_key}")
        except Exception as e:
            print(f"❌ 上傳失敗：{file}，錯誤：{e}")