from os import environ
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from google.cloud import storage

environ['GOOGLE_APPLICATION_CREDENTIALS'] = str("/home/europa/nlp-annotation-30942-2edc637f2a49.json")

client = storage.Client()
for blob in client.list_blobs('nlp-annotation-30942.appspot.com'):
  print(str(blob))

# cred = credentials.ApplicationDefault()
# app = firebase_admin.initialize_app(cred, {
#   'projectId': 'nlp-annotation-30942',
# })
# db = firestore.client()
# doc_ref = db.collection(u'videos')



