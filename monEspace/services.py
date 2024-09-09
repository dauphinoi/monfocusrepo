from sentence_transformers import SentenceTransformer
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
from django.core.files.storage import default_storage
from pinecone import Pinecone
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

nltk.download('punkt_tab')
nltk.download('stopwords')

load_dotenv()

# Initialisez le client OpenAI
client = OpenAI(api_key=os.getenv('openai_API_KEY'))


# Initialisation de Pinecone
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index = pc.Index(settings.PINECONE_INDEX_NAME)

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
    
    # essayer peut etre de ne pas stocker ce vecteur dans cette variable  et dans le mettre dire
    #directement dans la fonction upsert
    embedding = generate_embedding(content)
    
    # Upsert l'embedding dans Pinecone
    index.upsert(vectors=[(str(note.id), embedding.tolist(), {"title": note.title})])

def semantic_search(query, user):
    query_embedding = generate_embedding(query)
    
    # Utilisez Pinecone pour la recherche sémantique
    search_results = index.query(
        vector=query_embedding.tolist(),
        top_k=3,
        include_metadata=True
    )
    
    results = []
    for match in search_results['matches']:
        try:
            note = Note.objects.get(id=int(match['id']), user=user)
            
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
                'score': float(match['score']),
                'attachments': attachments_info
            })
        except ObjectDoesNotExist:
            # La note n'existe plus dans la base de données
            # Vous pourriez envisager de supprimer cet ID de Pinecone ici
            continue
    
    return sorted(results, key=lambda x: x['score'], reverse=True)



def analyze_image_with_gpt4(file_object, prompt="Décrivez en détail le contenu de cette image, en vous concentrant sur tout le texte visible et les informations importantes."):
    try:
        # Lire et encoder l'image directement depuis l'objet file
        encoded_image = base64.b64encode(file_object.read()).decode('utf-8')

        response = client.chat.completions.create(
            model="gpt-4o",  # Assurez-vous que c'est le bon nom du modèle
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
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


# gestion des homeworks

from django.core.mail import send_mail
from django.conf import settings

def send_email_to_teacher(homework, file_name, analysis_result):
    subject = f"Nouvelle analyse d'image pour le devoir: {homework.title}"
    message = f"""
    L'élève {homework.course.visitor.user.get_full_name()} a soumis une image pour analyse pour son devoir.
    
    Cours: {homework.course.subject.name}
    Devoir: {homework.title}
    Date limite: {homework.due_date}
    Nom du fichier: {file_name}
    
    Analyse de l'image:
    {analysis_result}
    """
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [homework.course.teacher.user.email]
    
    send_mail(subject, message, from_email, recipient_list)