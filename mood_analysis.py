# mood_analysis.py - Flask API for Mood Reporting & PDF Generation
# ---------------------------------------------------------------------------------
# Dependencies: pip install Flask pandas reportlab

import json
import os
import io
from flask import Flask, request, jsonify, send_file
from collections import Counter
import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie

app = Flask(__name__)

# --- CRITICAL CONFIGURATION ---
OUTPUT_DIR = 'mood data' 
OUTPUT_CSV_FILE = os.path.join(OUTPUT_DIR, 'mood_tracker_history.csv')

# --- CORS & HEADER SETUP ---
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    return response
app.after_request(add_cors_headers)

# --- CORE MOOD ANALYSIS LOGIC ---

def analyze_dominant_mood(data_log_list):
    """Analyzes mood data and returns statistics."""
    if not data_log_list:
        return {"error": "No data points recorded."}, 400

    mood_counts = Counter(item['expression'] for item in data_log_list)
    total_samples = len(data_log_list)
    
    chart_data = {
        mood: round((count / total_samples) * 100, 1)
        for mood, count in mood_counts.items()
    }
    
    dominant_mood, dominant_count = mood_counts.most_common(1)[0]
    
    recommendation = "Your overall mood is balanced. Keep up the good work!"
    if dominant_mood in ['sad', 'drowsy'] and chart_data.get(dominant_mood, 0) > 20:
        recommendation = (
            f"Your dominant state was {dominant_mood.upper()}. "
            "It's a perfect time for a quick mental reset! Try the Face Matching Emoji Game to shift your focus and release some stress."
        )

    # Save Raw Data to CSV
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        df = pd.DataFrame(data_log_list)
        header = not os.path.exists(OUTPUT_CSV_FILE)
        df.to_csv(OUTPUT_CSV_FILE, mode='a', header=header, index=False)
    except Exception as e:
        print(f"Error saving CSV: {e}")

    return {
        "success": True,
        "total_samples": total_samples,
        "dominant_mood": dominant_mood.upper(),
        "report_message": recommendation,
        "pie_chart_data": chart_data,
        "csv_saved_path": OUTPUT_CSV_FILE
    }, 200

# --- PDF GENERATION LOGIC (Uses reportlab) ---

def create_mood_report_pdf(report_data):
    """Generates a PDF using reportlab from the analyzed JSON data."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Title and Header
    p.setFont("Helvetica-Bold", 16)
    p.setFillColor(colors.darkblue)
    p.drawString(inch, height - 0.75 * inch, "Mysa AI Mood Analysis Report")
    p.line(inch, height - 0.9 * inch, width - inch, height - 0.9 * inch)

    # Dominant Mood and Summary
    y = height - 1.5 * inch
    p.setFont("Helvetica-Bold", 14)
    p.setFillColor(colors.black)
    p.drawString(inch, y, f"Dominant Expression: {report_data['dominant_mood']}")
    y -= 0.3 * inch

    p.setFont("Helvetica", 12)
    p.drawString(inch, y, f"Total Samples Analyzed: {report_data['total_samples']}")
    y -= 0.3 * inch
    
    p.setFont("Helvetica-Oblique", 11)
    p.drawString(inch, y, f"Recommendation: {report_data['report_message']}")
    y -= 0.5 * inch

    # Pie Chart Data Section (Graphical)
    p.setFont("Helvetica-Bold", 12)
    p.drawString(inch, y, "Mood Distribution:")
    y -= 0.1 * inch

    chart_data = report_data['pie_chart_data']
    data_values = list(chart_data.values())
    data_labels = [f"{k}: {v}%" for k, v in chart_data.items()]
    
    drawing = Drawing(400, 200)
    pie = Pie()
    pie.x = 50
    pie.y = 20
    pie.data = data_values
    pie.labels = data_labels
    pie.slices.strokeWidth = 0.5
    
    # Define colors
    colors_list = [colors.green, colors.orange, colors.red, colors.blue, colors.purple]
    for i, _ in enumerate(pie.data):
        pie.slices[i].fillColor = colors_list[i % len(colors_list)]

    drawing.add(pie)
    drawing.drawOn(p, inch, y - 3.0 * inch)
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer

# --- API ENDPOINTS ---

# Endpoint 1: Analysis (Returns JSON data)
@app.route('/api/analyze-mood', methods=['POST', 'OPTIONS'])
def analyze_mood_endpoint():
    """Receives JSON log data and returns analysis statistics as JSON."""
    if request.method == 'OPTIONS': return '', 200
        
    try:
        data = request.get_json()
        data_log = data.get('data_log', [])
        
        if not data_log:
            return jsonify({"error": "No valid data log received."}), 400
            
        report, status_code = analyze_dominant_mood(data_log)
        return jsonify(report), status_code

    except Exception as e:
        return jsonify({"error": f"Internal Server Error during analysis: {e}"}), 500

# Endpoint 2: PDF Generation (Triggers download)
@app.route('/api/generate-pdf', methods=['POST', 'OPTIONS'])
def generate_pdf_endpoint():
    """Receives JSON analysis data and returns a downloadable PDF."""
    if request.method == 'OPTIONS': return '', 200
    
    try:
        data = request.get_json()
        if not data or 'report_data' not in data:
            return jsonify({"error": "Missing 'report_data' in request."}), 400
        
        report_data = data['report_data']
        pdf_buffer = create_mood_report_pdf(report_data)
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='Mysa_Mood_Report.pdf'
        )
    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {e}"}), 500


# --- RUN INSTRUCTIONS ---
if __name__ == '__main__':
    print("Starting Mood Analysis API on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)