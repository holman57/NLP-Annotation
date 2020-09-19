from os import environ
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from google.cloud import storage
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report

environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(
    "C:\\Users\\holma\\Desktop\\NLP-Annotation\\backup\\firebase_python\\nlp-annotation-30942-2edc637f2a49.json")

client = storage.Client()
# for blob in client.list_blobs('nlp-annotation-30942.appspot.com'):
#   print(str(blob))

cred = credentials.ApplicationDefault()
app = firebase_admin.initialize_app(cred, {
    'projectId': 'nlp-annotation-30942',
})
db = firestore.client()
# doc_ref = db.collection(u'batch1')
docs = db.collection(u'videos').stream()

samples = pd.read_csv('../all.csv')

preds = np.empty(0)
original = np.empty(0)

print("dataframe size:", len(samples))

count = 0
doc_dict = []
for doc in docs:
    # print(f'{doc.id} => {doc.to_dict()}')
    doc_dict.append(doc.to_dict())
    if doc.to_dict()['label'].lower() == 'possible':
        preds = np.append(preds, 1)
    else:
        preds = np.append(preds, 0)
    original = np.append(original, np.array(samples[samples['id'] == doc.to_dict()['id']]['label']))
    count += 1

print(doc_dict)
print("Number of db entries:", count)
# print("size:", len(preds))
print("original", original)
print("preds", preds)

gold = 0
for o, p in zip(original, preds):
    if o == p:
        gold += 1

print("gold:", gold)
print("size:", len(original))

print(classification_report(original, preds))

df_doc = pd.DataFrame(doc_dict)
df_doc.to_csv("doc_df.csv", index=False)
