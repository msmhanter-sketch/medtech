import re

filepath = 'c:/MedServicePrice.kz/backend/service_catalog.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Add synonyms for popular searches
text = re.sub(
    r'(\'name\': \'МРТ головного мозга\', \'aliases\': \')\[\](\')', 
    r'\1["магнитно-резонансная томография", "МРТ головы", "томография мозга"]\2', 
    text
)

text = re.sub(
    r'(\'name\': \'УЗИ брюшной полости\', \'aliases\': \')\[\](\')', 
    r'\1["ультразвуковое исследование", "УЗИ ОБП", "брюшная полость"]\2', 
    text
)

text = re.sub(
    r'(\'name\': \'Общий анализ крови \(ОАК\)\', \'aliases\': \')\[\](\')', 
    r'\1["ОАК", "анализ крови", "клинический анализ крови", "CBC"]\2', 
    text
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated synonyms in service_catalog.py")
