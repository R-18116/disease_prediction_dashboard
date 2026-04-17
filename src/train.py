import pandas as pd
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

os.makedirs('models', exist_ok=True)

def build_and_save_pipeline(df, target_column, model_name, model_type='rf'):
    print(f"Training {model_name}...")
    
    # Separate features and target
    X = df.drop(target_column, axis=1)
    y = df[target_column]
    
    # Encode target if object
    if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y)
    
    # Identify numeric and categorical columns
    numeric_features = X.select_dtypes(include=['int64', 'float64']).columns
    categorical_features = X.select_dtypes(exclude=['int64', 'float64']).columns
    
    # If there are categorical features, we will dummy encode them (this handles Thyroid dataset)
    if len(categorical_features) > 0:
        X = pd.get_dummies(X, columns=categorical_features, drop_first=True)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Choose model
    if model_type == 'lr':
        clf = LogisticRegression(max_iter=1000)
    else:
        clf = RandomForestClassifier(random_state=42)
        
    # Build pipeline: Scale then Classifier
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', clf)
    ])
    
    pipeline.fit(X_train, y_train)
    acc = pipeline.score(X_test, y_test)
    print(f"{model_name} Accuracy: {acc:.4f}")
    
    # Save the full pipeline and feature columns to guarantee inference format
    model_data = {
        'pipeline': pipeline,
        'features': X.columns.tolist()
    }
    with open(f"models/{model_name}.pkl", "wb") as f:
        pickle.dump(model_data, f)
        
    print(f"Saved {model_name} successfully.\n")

if __name__ == '__main__':
    # 1. Diabetes
    try:
        diabetes_df = pd.read_csv('data/diabetes.csv')
        build_and_save_pipeline(diabetes_df, 'Outcome', 'diabetes_model', 'lr')
    except Exception as e:
        print("Error on diabetes:", e)

    # 2. Heart
    try:
        heart_df = pd.read_csv('data/heart.csv')
        build_and_save_pipeline(heart_df, 'target', 'heart_model', 'rf')
    except Exception as e:
        print("Error on heart:", e)

    # 3. Parkinsons
    try:
        parkinsons_df = pd.read_csv('data/parkinsons.csv')
        # Parkinsons dataset has a string column 'name' which is just an identifier, we must drop it
        if 'name' in parkinsons_df.columns:
            parkinsons_df = parkinsons_df.drop('name', axis=1)
        build_and_save_pipeline(parkinsons_df, 'status', 'parkinsons_model', 'rf')
    except Exception as e:
        print("Error on parkinsons:", e)

    # 4. Thyroid
    try:
        thyroid_df = pd.read_csv('data/thyroidDF.csv')
        # Some thyroid datasets have patient_id or similar, assuming features are ok
        if 'patient_id' in thyroid_df.columns:
            thyroid_df = thyroid_df.drop('patient_id', axis=1)
        build_and_save_pipeline(thyroid_df, 'target', 'thyroid_model', 'rf')
    except Exception as e:
        print("Error on thyroid:", e)
