import sqlite3
import pandas as pd

def detect_anomalies():
    conn = sqlite3.connect('c:/MedServicePrice.kz/backend/medtech.db')
    
    # Check parsed_price_rows
    df = pd.read_sql_query("SELECT id, matched_service_id, parsed_price_kzt, raw_name, clinic_id, source_file FROM parsed_price_rows WHERE match_status='auto_accepted' AND matched_service_id IS NOT NULL", conn)
    
    if len(df) == 0:
        print("No rows to analyze.")
        return
        
    medians = df.groupby('matched_service_id')['parsed_price_kzt'].median()
    df['median'] = df['matched_service_id'].map(medians)
    
    # 5x higher or 5x lower (0.2)
    anomalies = df[(df['parsed_price_kzt'] > df['median'] * 5) | (df['parsed_price_kzt'] < df['median'] * 0.2)]
    
    anomaly_ids = anomalies['id'].tolist()
    
    print(f"Total auto_accepted: {len(df)}")
    print(f"Anomalies detected: {len(anomalies)}")
    
    if anomaly_ids:
        # 1. Update parsed_price_rows to needs_review
        placeholders = ','.join(['?'] * len(anomaly_ids))
        conn.execute(f"UPDATE parsed_price_rows SET match_status='needs_review' WHERE id IN ({placeholders})", anomaly_ids)
        
        # 2. Delete from price_items so they don't show on frontend
        # We need to find which clinic_id + service_id pairs these belong to
        clinic_service_pairs = anomalies[['clinic_id', 'matched_service_id']].drop_duplicates()
        for _, row in clinic_service_pairs.iterrows():
            conn.execute("DELETE FROM price_items WHERE clinic_id=? AND service_id=?", (row['clinic_id'], row['matched_service_id']))
            
        conn.commit()
        print("Anomalies successfully flagged for review in Admin Panel.")
    else:
        print("No anomalies found.")

if __name__ == "__main__":
    detect_anomalies()
