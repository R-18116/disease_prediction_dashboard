document.addEventListener('DOMContentLoaded', () => {
    let currentDisease = 'diabetes';
    const form = document.getElementById('prediction-form');
    const dynamicInputs = document.getElementById('dynamic-inputs');
    const title = document.getElementById('disease-title');
    const navLinks = document.querySelectorAll('.nav-links li');
    
    // Result elements
    const resultBox = document.getElementById('result-text');
    const diagnosisEl = document.getElementById('diagnosis');
    const probEl = document.getElementById('probability-text');
    
    let importanceChartInstance = null;
    
    // Initialize Chart.js Gauge
    const ctx = document.getElementById('riskGauge').getContext('2d');
    let riskChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Safe', 'Warning', 'Danger'],
            datasets: [{
                data: [33.3, 33.3, 33.4],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)', // Success
                    'rgba(245, 158, 11, 0.8)', // Warning
                    'rgba(239, 68, 68, 0.8)'   // Danger
                ],
                borderWidth: 0,
                circumference: 180,
                rotation: -90
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        },
        // Custom plugin to draw the needle
        plugins: [{
            id: 'gaugeNeedle',
            afterDraw: (chart) => {
                const needleValue = chart.config.options.needleValue;
                if (needleValue === undefined) return;
                
                const { ctx, chartArea } = chart;
                const dataTotal = 100;
                const angle = Math.PI + (1 / dataTotal * needleValue * Math.PI);
                
                const cx = chart.getDatasetMeta(0).data[0].x;
                const cy = chart.getDatasetMeta(0).data[0].y;
                const radius = chart.innerRadius + (chart.outerRadius - chart.innerRadius) / 2;
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(radius, 0);
                ctx.lineTo(0, 5);
                ctx.fillStyle = '#f8fafc';
                ctx.fill();
                
                // Needle center dot
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }]
    });

    function setGaugeValue(value) {
        riskChart.options.needleValue = value;
        riskChart.update();
    }
    
    // Initial State: Needles at 0
    setGaugeValue(0);

    // Fetch and build form
    async function loadFeatures(disease) {
        dynamicInputs.innerHTML = '<div class="input-group"><p>Loading parameters...</p></div>';
        try {
            const res = await fetch(`/api/features/${disease}`);
            if (!res.ok) throw new Error('Failed to load features');
            const features = await res.json();
            
            dynamicInputs.innerHTML = '';
            
            const placeholders = {
                'BloodPressure': 'e.g., 80-120',
                'Glucose': 'e.g., 70-140',
                'BMI': 'e.g., 18.5-24.9',
                'Age': 'e.g., 20-80',
                'Pregnancies': 'e.g., 0-5',
                'SkinThickness': 'e.g., 10-30',
                'Insulin': 'e.g., 15-276',
                'DiabetesPedigreeFunction': 'e.g., 0.1-1.0',
                'age': 'e.g., 20-80',
                'trestbps': 'e.g., 90-140 (Resting Blood Pressure)',
                'chol': 'e.g., 120-250 (Cholesterol)',
                'thalach': 'e.g., 70-180 (Max HR)',
                'cp': 'e.g., 0-3 (Chest Pain Type)',
                'fbs': 'e.g., 0 or 1 (Fasting Blood Sugar > 120)',
                'restecg': 'e.g., 0-2',
                'exang': 'e.g., 0 or 1 (Exercise Induced Angina)',
                'oldpeak': 'e.g., 0.0-4.0',
                'slope': 'e.g., 0-2',
                'ca': 'e.g., 0-4',
                'thal': 'e.g., 0-3',
                'MDVP:Fo(Hz)': 'e.g., 119.992',
                'MDVP:Fhi(Hz)': 'e.g., 157.302',
                'MDVP:Flo(Hz)': 'e.g., 74.997'
            };

            features.forEach((feat, index) => {
                // Formatting feature name for label
                let label = feat.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                label = label.charAt(0).toUpperCase() + label.slice(1);
                
                let placeholder = placeholders[feat] || 'e.g., 1.0';
                
                const group = document.createElement('div');
                group.className = 'input-group';
                group.style.animationDelay = `${index * 0.05}s`;
                
                group.innerHTML = `
                    <label for="${feat}">${label}</label>
                    <input type="number" id="${feat}" name="${feat}" step="any" required placeholder="${placeholder}">
                `;
                dynamicInputs.appendChild(group);
            });
            
            await loadImportanceChart(disease);
        } catch (e) {
            dynamicInputs.innerHTML = `<div class="input-group"><p style="color:red">Error loading parameters. Is the backend running?</p></div>`;
        }
    }

    async function loadImportanceChart(disease) {
        try {
            const res = await fetch(`/api/importance/${disease}`);
            if (!res.ok) return;
            const data = await res.json();
            
            const insightsSection = document.getElementById('insights-section');
            if (!data || data.length === 0) {
                insightsSection.style.display = 'none';
                return;
            }
            
            insightsSection.style.display = 'block';
            
            const ctxImp = document.getElementById('importanceChart').getContext('2d');
            if (importanceChartInstance) {
                importanceChartInstance.destroy();
            }
            
            const labels = data.map(d => {
                let name = d.feature.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                return name.length > 15 ? name.substring(0, 15) + '...' : name;
            });
            const vals = data.map(d => d.importance);
            
            importanceChartInstance = new Chart(ctxImp, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Feature Importance',
                        data: vals,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { 
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { 
                                color: '#94a3b8',
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1
                        }
                    }
                }
            });
        } catch(e) {
            console.error("Error loading insights:", e);
        }
    }

    // Precautions Database
    const precautionsDb = {
        'diabetes': {
            name: 'Diabetes',
            high: [
                'Consult an endocrinologist for a comprehensive treatment plan.',
                'Monitor blood sugar levels daily.',
                'Adopt a low-carb, high-fiber diet to control glucose spikes.',
                'Schedule regular eye and kidney check-ups.'
            ],
            low: [
                'Maintain a healthy, balanced diet.',
                'Engage in at least 30 minutes of physical activity daily.',
                'Keep routine annual check-ups to track A1C levels.'
            ]
        },
        'heart': {
            name: 'Heart Disease',
            high: [
                'Seek immediate consultation with a cardiologist.',
                'Strictly limit sodium (salt) and bad cholesterol intake.',
                'Monitor blood pressure regularly.',
                'Avoid smoking and reduce alcohol consumption.',
                'Discuss appropriate medications (e.g., statins, beta-blockers) with your doctor.'
            ],
            low: [
                'Engage in cardiovascular exercises (brisk walking, swimming) regularly.',
                'Eat a diet rich in fruits, vegetables, and omega-3 fatty acids.',
                'Manage stress through relaxation techniques or yoga.'
            ]
        },
        'parkinsons': {
            name: 'Parkinson\'s Disease',
            high: [
                'Consult a neurologist specializing in movement disorders.',
                'Consider physical therapy to maintain balance and mobility.',
                'Discuss medication options like levodopa with your healthcare provider.',
                'Ensure a safe home environment to prevent falls.'
            ],
            low: [
                'Stay active with aerobic exercises and stretching.',
                'Maintain a nutrient-dense diet to protect brain health.',
                'Engage in cognitive exercises and social activities.'
            ]
        },
        'thyroid': {
            name: 'Thyroid Disease',
            high: [
                'Consult an endocrinologist for thyroid hormone testing (TSH, T3, T4).',
                'Discuss potential hormone replacement therapy or anti-thyroid medications.',
                'Monitor energy levels, weight changes, and heart rate.',
                'Maintain a balanced diet including adequate iodine and selenium.'
            ],
            low: [
                'Ensure sufficient dietary iodine intake.',
                'Get routine check-ups and thyroid function tests annually.',
                'Maintain a healthy lifestyle to support systemic metabolism.'
            ]
        }
    };

    // Result elements
    const precautionsBox = document.getElementById('precautions-box');
    const precautionsList = document.getElementById('precautions-list');
    const diseaseNameDisplay = document.getElementById('disease-name-display');

    // Handle navigation
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            currentDisease = link.dataset.target;
            const uiTitle = link.innerText.trim();
            title.innerText = `${uiTitle} Prediction`;
            
            // Reset UI
            resultBox.classList.add('hidden');
            precautionsBox.classList.add('hidden');
            setGaugeValue(0);
            const insightsSection = document.getElementById('insights-section');
            if (insightsSection) insightsSection.style.display = 'none';
            
            loadFeatures(currentDisease);
        });
    });

    // Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Disable button visually
        const btn = form.querySelector('button');
        const ogText = btn.innerHTML;
        btn.innerHTML = `<span>Analyzing...</span><i class="fa-solid fa-spinner fa-spin"></i>`;
        
        // Gather data
        const formData = new FormData(form);
        const dataObj = {};
        for (let [key, value] of formData.entries()) {
            dataObj[key] = value;
        }

        try {
            const res = await fetch(`/predict/${currentDisease}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataObj)
            });
            const result = await res.json();
            
            if (result.error) {
                alert(`Error: ${result.error}`);
            } else {
                const prob = result.probability; // 0 to 100
                const pred = result.prediction;
                
                // Update gauge
                setGaugeValue(prob);
                
                // Determine risk strings and UI state
                let isHighRisk = (pred === 1 || prob > 50);
                
                const dbInfo = precautionsDb[currentDisease] || { name: 'Disease', high: [], low: [] };
                diseaseNameDisplay.innerText = dbInfo.name;
                
                // Update text
                probEl.innerText = `${prob.toFixed(1)}%`;
                
                resultBox.classList.remove('hidden', 'risk-high', 'risk-low');
                precautionsBox.classList.remove('hidden');
                
                if (isHighRisk) {
                    diagnosisEl.innerText = 'High Risk Detected';
                    resultBox.classList.add('risk-high');
                    
                    // Render high risk precautions
                    precautionsList.innerHTML = dbInfo.high.map(item => `<li>${item}</li>`).join('');
                } else {
                    diagnosisEl.innerText = 'Low Risk';
                    resultBox.classList.add('risk-low');
                    
                    // Render low risk precautions
                    precautionsList.innerHTML = dbInfo.low.map(item => `<li>${item}</li>`).join('');
                }
            }
        } catch(e) {
            alert('Failed to connect to backend.');
        } finally {
            btn.innerHTML = ogText;
        }
    });

    // Initial Load
    loadFeatures(currentDisease);
});
