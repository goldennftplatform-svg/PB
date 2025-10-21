# PEPEBALL Frontend Deployment Script
# Deploy to GitHub Pages for instant live hosting

echo "🎰 Deploying PEPEBALL Frontend to GitHub Pages..."

# Create a simple index.html that works standalone
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PEPEBALL - Powerball Lottery Token</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Press Start 2P', monospace;
            background: linear-gradient(45deg, #ff69b4, #ff1493, #ff69b4);
            background-size: 400% 400%;
            animation: gradientShift 3s ease infinite;
            color: #00ff00;
            overflow-x: hidden;
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            text-shadow: 3px 3px 0px #000;
        }
        
        .title {
            font-size: 3rem;
            color: #ffff00;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
        
        .subtitle {
            font-size: 1.2rem;
            color: #00ffff;
            margin-bottom: 10px;
        }
        
        .pepe-emoji {
            font-size: 4rem;
            margin: 20px 0;
            animation: rotate 3s linear infinite;
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .lottery-section {
            background: rgba(0, 0, 0, 0.9);
            border: 4px solid #ff1493;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 40px;
            box-shadow: 0 0 30px rgba(255, 20, 147, 0.5);
        }
        
        .lottery-title {
            font-size: 2rem;
            color: #ffff00;
            text-align: center;
            margin-bottom: 20px;
            text-shadow: 2px 2px 0px #000;
        }
        
        .jackpot-display {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .jackpot-amount {
            font-size: 3rem;
            color: #ff69b4;
            text-shadow: 3px 3px 0px #000;
            margin-bottom: 10px;
        }
        
        .jackpot-timer {
            font-size: 1.2rem;
            color: #00ffff;
        }
        
        .pricing-info {
            margin: 20px 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 10px;
            border: 2px solid #ff69b4;
        }
        
        .pricing-title {
            font-size: 1.2rem;
            color: #ffff00;
            text-align: center;
            margin-bottom: 15px;
            font-weight: bold;
        }
        
        .pricing-tiers {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
        }
        
        .pricing-tier {
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .pricing-tier:hover {
            border-color: #ffff00;
            transform: translateY(-3px);
        }
        
        .tier-price {
            display: block;
            font-size: 1.2rem;
            color: #ff69b4;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .tier-tickets {
            display: block;
            font-size: 0.9rem;
            color: #00ffff;
            margin-bottom: 5px;
        }
        
        .tier-bonus {
            display: block;
            font-size: 0.7rem;
            color: #ffff00;
            background: rgba(255, 255, 0, 0.2);
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .enter-lottery {
            text-align: center;
            margin-top: 30px;
        }
        
        .lottery-btn {
            background: linear-gradient(45deg, #ff69b4, #ff1493);
            border: 3px solid #ffff00;
            color: #000;
            font-family: 'Press Start 2P', monospace;
            font-size: 1.2rem;
            padding: 15px 30px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            margin: 10px;
        }
        
        .lottery-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            background: linear-gradient(45deg, #ff1493, #ff69b4);
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .feature-card {
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        
        .feature-title {
            font-size: 1rem;
            color: #ffff00;
            margin-bottom: 10px;
        }
        
        .feature-text {
            font-size: 0.8rem;
            color: #00ffff;
            line-height: 1.5;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.8);
            border-top: 2px solid #00ff00;
        }
        
        .footer-text {
            font-size: 0.8rem;
            color: #ff69b4;
        }
        
        .bubble {
            position: absolute;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            animation: float 6s ease-in-out infinite;
        }
        
        .bubble:nth-child(1) {
            width: 80px;
            height: 80px;
            top: 20%;
            left: 10%;
            animation-delay: 0s;
        }
        
        .bubble:nth-child(2) {
            width: 60px;
            height: 60px;
            top: 60%;
            right: 15%;
            animation-delay: 2s;
        }
        
        .bubble:nth-child(3) {
            width: 100px;
            height: 100px;
            bottom: 20%;
            left: 20%;
            animation-delay: 4s;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        
        @media (max-width: 768px) {
            .title {
                font-size: 2rem;
            }
            
            .jackpot-amount {
                font-size: 2rem;
            }
            
            .pricing-tiers {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="bubble"></div>
    <div class="bubble"></div>
    <div class="bubble"></div>
    
    <div class="container">
        <div class="header">
            <div class="title">🎰 PEPEBALL 🎰</div>
            <div class="pepe-emoji">🐸</div>
            <div class="subtitle">Powerball Lottery Token</div>
            <div class="subtitle">8-bit meets South Park meets PEPE</div>
        </div>
        
        <div class="lottery-section">
            <div class="lottery-title">🎲 CURRENT JACKPOT 🎲</div>
            <div class="jackpot-display">
                <div class="jackpot-amount">20 SOL</div>
                <div class="jackpot-timer">Next draw in: 72 hours</div>
            </div>
            
            <div class="pricing-info">
                <div class="pricing-title">💰 Dynamic Pricing 💰</div>
                <div class="pricing-tiers">
                    <div class="pricing-tier">
                        <span class="tier-price">$20</span>
                        <span class="tier-tickets">1 ticket</span>
                        <span class="tier-bonus">Basic</span>
                    </div>
                    <div class="pricing-tier">
                        <span class="tier-price">$100</span>
                        <span class="tier-tickets">4 tickets</span>
                        <span class="tier-bonus">100% bonus</span>
                    </div>
                    <div class="pricing-tier">
                        <span class="tier-price">$500</span>
                        <span class="tier-tickets">10 tickets</span>
                        <span class="tier-bonus">400% bonus</span>
                    </div>
                </div>
            </div>
            
            <div class="enter-lottery">
                <button class="lottery-btn" onclick="alert('🎰 Connect wallet to enter lottery! Coming soon! 🎰')">
                    🎫 ENTER LOTTERY 🎫
                </button>
                <button class="lottery-btn" onclick="window.open('https://github.com/preseteth/pepeball', '_blank')">
                    📁 VIEW CODE 📁
                </button>
                <button class="lottery-btn" onclick="window.open('https://pump.fun', '_blank')">
                    🚀 LAUNCH SOON 🚀
                </button>
            </div>
        </div>
        
        <div class="features">
            <div class="feature-card">
                <div class="feature-title">🛡️ Anti-Rug</div>
                <div class="feature-text">85% instant renounce + burnt LP. Only fire-alarm admin access.</div>
            </div>
            
            <div class="feature-card">
                <div class="feature-title">💰 SOL Payouts</div>
                <div class="feature-text">Winners get SOL, not tokens. Protects price and holders.</div>
            </div>
            
            <div class="feature-card">
                <div class="feature-title">🚀 Dynamic Timing</div>
                <div class="feature-text">72h draws < 200 SOL, 36h draws ≥ 200 SOL</div>
            </div>
            
            <div class="feature-card">
                <div class="feature-title">🎯 Fair Distribution</div>
                <div class="feature-text">1 main winner (60%) + 5 minor winners (8% each)</div>
            </div>
            
            <div class="feature-card">
                <div class="feature-title">🐸 Creator Fund</div>
                <div class="feature-text">0.05% perpetual payout to Matt Furie (PEPE creator)</div>
            </div>
            
            <div class="feature-card">
                <div class="feature-title">💎 Dynamic Pricing</div>
                <div class="feature-text">Volume discounts: $20=1, $100=4, $500=10 tickets</div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">
                Built with ❤️ for the PEPE community<br>
                Honoring Matt Furie, the creator of PEPE<br>
                🐸 PEPEBALL - Where memes meet money 🐸<br><br>
                <strong>GitHub:</strong> <a href="https://github.com/preseteth/pepeball" style="color: #00ffff;">github.com/preseteth/pepeball</a><br>
                <strong>Status:</strong> Ready for launch! 🚀
            </div>
        </div>
    </div>
    
    <script>
        // Simple countdown timer
        function updateTimer() {
            const nextDraw = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours from now
            const now = new Date();
            const diff = nextDraw - now;
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            document.querySelector('.jackpot-timer').textContent = 
                `Next draw in: ${hours}h ${minutes}m`;
        }
        
        // Update timer every minute
        setInterval(updateTimer, 60000);
        updateTimer();
        
        // Add some interactive effects
        document.querySelectorAll('.pricing-tier').forEach(tier => {
            tier.addEventListener('click', () => {
                tier.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    tier.style.transform = 'translateY(-3px)';
                }, 200);
            });
        });
    </script>
</body>
</html>
EOF

echo "✅ Frontend ready for deployment!"
echo "🚀 Ready to launch PEPEBALL!"
