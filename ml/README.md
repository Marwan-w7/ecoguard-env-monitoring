# EcoGuard ML Components

## 🧠 Machine Learning Pipeline

This directory contains all ML-related components for disaster prediction and risk assessment.

## 📁 Structure
```
ml/
├── notebooks/          # Jupyter notebooks for exploration and training
├── models/            # Trained model artifacts
├── data/              # Training and test datasets
├── scripts/           # Python scripts for data processing
└── requirements.txt   # ML dependencies
```

## 🎯 Models

### 1. Flood Prediction Model
- **Type**: XGBoost Classifier/Regressor
- **Features**: rainfall_1h, rainfall_3h, elevation, soil_saturation, river_gauge
- **Output**: Flood probability (0-1) for next 3-6 hours
- **Training**: Historical weather + flood reports

### 2. Air Quality Prediction
- **Type**: LSTM/Prophet Time Series
- **Features**: PM2.5, PM10, weather conditions, traffic patterns
- **Output**: AQI forecast for next 24 hours
- **Training**: Historical AQI + meteorological data

### 3. Wildfire Risk Assessment
- **Type**: Random Forest
- **Features**: temperature, humidity, wind_speed, vegetation_index, drought_index
- **Output**: Fire risk score (low/medium/high)
- **Training**: NASA FIRMS fire data + weather

## 🚀 Quick Start

### Local Development
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start Jupyter
jupyter notebook
```

### Google Colab
1. Upload notebooks to Google Drive
2. Open with Google Colab
3. Install requirements: `!pip install -r requirements.txt`
4. Mount Drive: `from google.colab import drive; drive.mount('/content/drive')`

## 📊 Data Sources

### Training Data
- **Weather**: OpenWeather historical API
- **Floods**: Government flood reports, news archives
- **Air Quality**: OpenAQ historical data
- **Fires**: NASA FIRMS archive
- **Geography**: OpenStreetMap, elevation APIs

### Features Engineering
- **Temporal**: hour_of_day, day_of_week, season
- **Spatial**: distance_to_water, elevation, population_density
- **Weather**: rolling_averages, weather_derivatives
- **Lag Features**: previous_24h_rain, previous_week_aqi

## 🔄 Model Pipeline

1. **Data Collection** (`scripts/collect_data.py`)
2. **Feature Engineering** (`scripts/feature_engineering.py`)
3. **Model Training** (`notebooks/train_models.ipynb`)
4. **Model Evaluation** (`notebooks/evaluate_models.ipynb`)
5. **Model Deployment** (`scripts/deploy_to_hf.py`)

## 📈 Model Performance Targets

| Model | Metric | Target | Current |
|-------|--------|--------|---------|
| Flood | Precision | >0.80 | TBD |
| Flood | Recall | >0.75 | TBD |
| AQI | MAE | <15 AQI | TBD |
| Fire | F1-Score | >0.85 | TBD |

## 🚀 Deployment

### Hugging Face Spaces
```bash
# Deploy trained model
python scripts/deploy_to_hf.py --model flood_xgb_v1 --space ecoguard/flood-prediction
```

### API Endpoints
- `POST /predict/flood` - Flood probability prediction
- `POST /predict/aqi` - Air quality forecast
- `POST /predict/fire` - Wildfire risk assessment
- `GET /model/info` - Model metadata and performance

## 🔍 Model Explainability

All models include SHAP explanations:
- Feature importance rankings
- Individual prediction explanations
- Global model behavior analysis

## 📝 Notebooks

1. `01_data_exploration.ipynb` - EDA and data quality analysis
2. `02_feature_engineering.ipynb` - Feature creation and selection
3. `03_flood_model.ipynb` - Flood prediction model training
4. `04_aqi_model.ipynb` - Air quality forecasting model
5. `05_fire_model.ipynb` - Wildfire risk model
6. `06_model_evaluation.ipynb` - Cross-validation and testing
7. `07_deployment_prep.ipynb` - Model packaging for deployment