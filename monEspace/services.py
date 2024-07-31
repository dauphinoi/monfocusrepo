import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
from .models import Note
import re
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import nltk
from bs4 import BeautifulSoup
import base64
import os
from openai import OpenAI
from dotenv import load_dotenv

# nltk.download('punkt')
# nltk.download('stopwords')

load_dotenv()

# Initialisez le client OpenAI
client = OpenAI(api_key=os.getenv('openai_API_KEY'))

model = SentenceTransformer('all-mpnet-base-v2')

def clean_html(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text()

def preprocess_text(text):
    # Nettoyer le HTML
    text = clean_html(text)
    
    # Convertir en minuscules et supprimer les caractères spéciaux
    text = re.sub(r'[^\w\s]', '', text.lower())
    
    # Tokenization et suppression des stop words
    stop_words = set(stopwords.words('french'))
    word_tokens = word_tokenize(text)
    filtered_text = [w for w in word_tokens if not w in stop_words]
    
    return ' '.join(filtered_text)

def generate_embedding(text):
    preprocessed_text = preprocess_text(text)
    return model.encode(preprocessed_text)

def update_note_embedding(note):
    content = f"{note.title} {clean_html(note.content)}"
    for attachment in note.attachments.all():
        if attachment.file_type == 'image' and attachment.content:
            content += f" Image '{attachment.file.name}': {attachment.content}"
        else:
            content += f" {attachment.file_type} {attachment.file.name}"
    
    embedding = generate_embedding(content)
    note.set_embedding(embedding)
    note.save()

def semantic_search(query, user):
    query_embedding = generate_embedding(query)
    notes = list(Note.objects.filter(user=user))
    embeddings = [note.get_embedding() for note in notes if note.get_embedding() is not None]
    
    if not embeddings:
        return []

    embeddings_array = np.array(embeddings)
    
    faiss.normalize_L2(embeddings_array)
    index = faiss.IndexFlatIP(embeddings_array.shape[1])
    index.add(embeddings_array)
    
    k = min(3, len(embeddings))
    scores, indices = index.search(np.array([query_embedding]), k)
    
    results = []
    for i, idx in enumerate(indices[0]):
        note = notes[int(idx)]
        score = float(scores[0][i])
        clean_content = clean_html(note.content)
        attachments_info = [
            {
                'id': att.id,
                'file_name': att.file.name,
                'file_type': att.file_type,
                'content': att.content if att.file_type == 'image' else None
            } for att in note.attachments.all()
        ]
        results.append({
            'id': note.id,
            'title': note.title,
            'content_preview': clean_content[:100] + '...',
            'score': score,
            'attachments': attachments_info
        })
    
    return sorted(results, key=lambda x: x['score'], reverse=True)

def analyze_image_with_gpt4(image_path):
    with open(image_path, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read()).decode('utf-8')

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Décrivez en détail le contenu de cette image, en vous concentrant sur tout le texte visible et les informations importantes."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encoded_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Erreur lors de l'analyse de l'image : {str(e)}")
        return "Impossible d'analyser l'image."