from flask import Flask, render_template, request, jsonify
import pickle
import pandas as pd
import os

app = Flask(__name__)

# Load models dynamically
def load_model(name):
    path = os.path.join(os.path.dirname(__file__), f"models/{name}_model.pkl")
    if os.path.exists(path):
        with open(path, "rb") as f:
            return pickle.load(f)
    return None

models = {
    "diabetes": load_model("diabetes"),
    "heart": load_model("heart"),
    "parkinsons": load_model("parkinsons"),
    "thyroid": load_model("thyroid")
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/features/<disease>")
def get_features(disease):
    if disease not in models or models[disease] is None:
        return jsonify({"error": "Model not available"}), 404
    return jsonify(models[disease]['features'])

@app.route("/predict/<disease>", methods=["POST"])
def predict(disease):
    if disease not in models or models[disease] is None:
        return jsonify({"error": f"{disease} model not loaded properly."}), 400
        
    try:
        data = request.json
        model_data = models[disease]
        pipeline = model_data['pipeline']
        features = model_data['features']
        
        # Build dataframe in exact order
        input_dict = {}
        for feat in features:
            # Handle categorical flags that might have been get_dummies encoded
            # If the json passed has original categories, we'd need to dummy it here
            # For simplicity, we are expecting raw numeric inputs from the frontend
            # The frontend will map to the dummy columns directly where necessary 
            val = data.get(feat, 0)
            input_dict[feat] = float(val) if val != '' else 0.0
            
        df = pd.DataFrame([input_dict])
        
        pred = pipeline.predict(df)[0]
        # Ensure we don't index proba arrays wrongly if model doesn't support it
        if hasattr(pipeline, "predict_proba"):
            prob = pipeline.predict_proba(df)[0][1]
        else:
            prob = float(pred)
            
        return jsonify({
            "prediction": int(pred),
            "probability": float(prob) * 100
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/importance/<disease>")
def get_importance(disease):
    if disease not in models or models[disease] is None:
        return jsonify({"error": "Model not available"}), 404
        
    model_data = models[disease]
    pipeline = model_data['pipeline']
    features = model_data['features']
    
    classifier = pipeline.named_steps['classifier']
    importances = []
    
    if hasattr(classifier, 'feature_importances_'):
        importances = classifier.feature_importances_.tolist()
    elif hasattr(classifier, 'coef_'):
        importances = [abs(c) for c in classifier.coef_[0].tolist()]
        
    if importances:
        feat_imp = [{"feature": f, "importance": i} for f, i in zip(features, importances)]
        feat_imp.sort(key=lambda x: abs(x["importance"]), reverse=True)
        return jsonify(feat_imp[:12]) # Provide top 12 features
    
    return jsonify([])

if __name__ == "__main__":
    app.run(debug=True, port=5000)
