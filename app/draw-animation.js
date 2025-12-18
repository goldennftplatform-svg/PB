// Retro-Futuristic Draw Animation - 50/50 Rollover Style
// Orbiting Pepe balls around Solana sun with glitch effects

class DrawAnimation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.balls = [];
        this.frame = 0;
        this.isAnimating = false;
        this.pepeCount = 0;
        this.isOdd = false;
        this.animationDuration = 5000; // 5 seconds
        this.startTime = 0;
        
        // Solana sun image (placeholder - can be replaced with actual image)
        this.solSunImg = null;
        this.loadSolSun();
    }
    
    loadSolSun() {
        // Create a simple Solana sun graphic programmatically
        const sunCanvas = document.createElement('canvas');
        sunCanvas.width = 100;
        sunCanvas.height = 100;
        const sunCtx = sunCanvas.getContext('2d');
        
        // Draw Solana sun (yellow circle with rays)
        sunCtx.fillStyle = '#FFD700';
        sunCtx.beginPath();
        sunCtx.arc(50, 50, 40, 0, Math.PI * 2);
        sunCtx.fill();
        
        // Add rays
        sunCtx.strokeStyle = '#FFD700';
        sunCtx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            sunCtx.beginPath();
            sunCtx.moveTo(50 + Math.cos(angle) * 40, 50 + Math.sin(angle) * 40);
            sunCtx.lineTo(50 + Math.cos(angle) * 50, 50 + Math.sin(angle) * 50);
            sunCtx.stroke();
        }
        
        this.solSunImg = sunCanvas;
    }
    
    startAnimation(pepeCount) {
        if (this.isAnimating) return;
        
        this.pepeCount = pepeCount || (Math.floor(Math.random() * 30) + 1);
        this.isOdd = this.pepeCount % 2 === 1;
        this.isAnimating = true;
        this.frame = 0;
        this.startTime = Date.now();
        
        // Create balls array
        this.balls = [];
        for (let i = 0; i < this.pepeCount; i++) {
            const isPepe = Math.random() > 0.5;
            this.balls.push({
                num: isPepe ? '🐸' : (i + 1),
                color: i % 2 === 0 ? '#00D4FF' : '#FF6B00',
                angle: (i * Math.PI * 2) / this.pepeCount,
                radius: 200,
                speed: 0.02 + Math.random() * 0.03,
                x: 0,
                y: 0,
                size: 30
            });
        }
        
        this.animate();
    }
    
    animate() {
        if (!this.isAnimating) return;
        
        const elapsed = Date.now() - this.startTime;
        const progress = Math.min(elapsed / this.animationDuration, 1);
        
        // Clear with glitch effect
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add glitch lines
        if (Math.random() > 0.95) {
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, Math.random() * this.canvas.height);
            this.ctx.lineTo(this.canvas.width, Math.random() * this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw grid background
        this.drawGrid();
        
        // Update and draw balls
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.balls.forEach((ball, i) => {
            // Orbital motion
            ball.angle += ball.speed;
            ball.x = centerX + Math.cos(ball.angle) * ball.radius;
            ball.y = centerY + Math.sin(ball.angle) * ball.radius;
            
            // Add wobble effect
            const wobbleX = Math.sin(this.frame / 10 + i) * 10;
            const wobbleY = Math.cos(this.frame / 10 + i) * 10;
            
            // Draw ball
            this.ctx.beginPath();
            this.ctx.arc(ball.x + wobbleX, ball.y + wobbleY, ball.size, 0, Math.PI * 2);
            this.ctx.fillStyle = ball.color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw number/emoji
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(ball.num, ball.x + wobbleX, ball.y + wobbleY);
        });
        
        // Draw Solana sun in center
        if (this.solSunImg) {
            this.ctx.drawImage(
                this.solSunImg,
                centerX - 50,
                centerY - 50,
                100,
                100
            );
        }
        
        // Show countdown/result
        if (progress < 0.8) {
            // Spinning phase
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `Pepe Balls: ${this.pepeCount}`,
                centerX,
                centerY + 150
            );
        } else {
            // Result phase
            const resultText = this.isOdd ? '🎉 PAYOUT TIME! 🎉' : '🚀 ROLLOVER! 🚀';
            const resultColor = this.isOdd ? '#00ff00' : '#ff6b00';
            
            this.ctx.fillStyle = resultColor;
            this.ctx.font = 'bold 50px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(resultText, centerX, centerY + 150);
            
            // Show details
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 24px Arial';
            if (this.isOdd) {
                this.ctx.fillText('50% Main • 40% Minors • 10% House', centerX, centerY + 200);
            } else {
                this.ctx.fillText('Jackpot Grows • Timer Extended', centerX, centerY + 200);
            }
        }
        
        this.frame++;
        
        if (progress >= 1) {
            // Animation complete
            this.isAnimating = false;
            this.showResult();
        } else {
            requestAnimationFrame(() => this.animate());
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.2;
        
        // Vertical lines
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1.0;
    }
    
    showResult() {
        // Trigger confetti or explosion effect
        if (this.isOdd) {
            this.confettiEffect();
        } else {
            this.rolloverEffect();
        }
        
        // Dispatch event for UI updates
        const event = new CustomEvent('drawComplete', {
            detail: {
                pepeCount: this.pepeCount,
                isOdd: this.isOdd,
                result: this.isOdd ? 'payout' : 'rollover'
            }
        });
        document.dispatchEvent(event);
    }
    
    confettiEffect() {
        // Simple confetti using canvas
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'absolute';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.top = '-10px';
                confetti.style.width = '10px';
                confetti.style.height = '10px';
                confetti.style.backgroundColor = ['#00ff00', '#ff6b00', '#00D4FF', '#FFD700'][Math.floor(Math.random() * 4)];
                confetti.style.borderRadius = '50%';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                confetti.style.animation = `confettiFall ${2 + Math.random()}s linear forwards`;
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 50);
        }
    }
    
    rolloverEffect() {
        // Explosion/pulse effect for rollover
        const pulse = document.createElement('div');
        pulse.style.position = 'absolute';
        pulse.style.left = '50%';
        pulse.style.top = '50%';
        pulse.style.transform = 'translate(-50%, -50%)';
        pulse.style.width = '200px';
        pulse.style.height = '200px';
        pulse.style.borderRadius = '50%';
        pulse.style.border = '5px solid #ff6b00';
        pulse.style.pointerEvents = 'none';
        pulse.style.zIndex = '9999';
        pulse.style.animation = 'rolloverPulse 1s ease-out forwards';
        document.body.appendChild(pulse);
        
        setTimeout(() => pulse.remove(), 1000);
    }
    
    replay() {
        this.startAnimation(this.pepeCount);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
        }
    }
    
    @keyframes rolloverPulse {
        0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
        }
    }
    
    .draw-animation-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 20px 0;
    }
    
    .draw-animation-canvas {
        border: 3px solid #00ff00;
        border-radius: 15px;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
        background: #000;
        filter: hue-rotate(0deg);
        animation: glitch 3s infinite;
    }
    
    @keyframes glitch {
        0%, 100% { filter: hue-rotate(0deg); }
        25% { filter: hue-rotate(90deg); }
        50% { filter: hue-rotate(180deg); }
        75% { filter: hue-rotate(270deg); }
    }
    
    .replay-btn {
        margin-top: 15px;
        padding: 12px 30px;
        background: linear-gradient(45deg, #00ff00, #00D4FF);
        color: #000;
        border: none;
        border-radius: 8px;
        font-size: 1.2em;
        font-weight: bold;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 2px;
        transition: all 0.3s;
        box-shadow: 0 4px 15px rgba(0, 255, 0, 0.3);
    }
    
    .replay-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0, 255, 0, 0.5);
    }
    
    .replay-btn:active {
        transform: scale(0.95);
    }
`;
document.head.appendChild(style);

// Export for global use
if (typeof window !== 'undefined') {
    window.DrawAnimation = DrawAnimation;
}

