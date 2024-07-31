import openai
import pytesseract
from PIL import Image
import whisper

def create_embedding(text):
    response = openai.Embedding.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response['data'][0]['embedding']

def perform_ocr(image_path):
    image = Image.open(image_path)
    return pytesseract.image_to_string(image)

def transcribe_with_whisper(audio_path):
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    return result["text"]