// Slot Machine + Keno + Powerball Hybrid Draw Animation
// Professional casino aesthetic with muted colors

class DrawAnimation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 900;
        this.canvas.height = 500;
        
        // Muted professional colors
        this.colors = {
            background: '#1a1a2e',
            slotBg: '#16213e',
            reelBg: '#0f3460',
            ballWhite: '#f5f5f5',
            ballBlue: '#2c5f8d',
            ballRed: '#8b1538',
            gold: '#d4af37',
            text: '#e8e8e8',
            accent: '#4a90a4'
        };
        
        this.reels = [];
        this.kenoBalls = [];
        this.pepeCount = 0;
        this.isOdd = false;
        this.isAnimating = false;
        this.phase = 'slots'; // 'slots' -> 'keno' -> 'reveal'
        this.frame = 0;
        this.startTime = 0;
        this.animationDuration = 6000; // 6 seconds total
    }
    
    startAnimation(pepeCount) {
        if (this.isAnimating) return;
        
        this.pepeCount = pepeCount || (Math.floor(Math.random() * 30) + 1);
        this.isOdd = this.pepeCount % 2 === 1;
        this.isAnimating = true;
        this.frame = 0;
        this.startTime = Date.now();
        this.phase = 'slots';
        
        // Initialize slot reels (3 reels showing numbers)
        this.reels = [];
        for (let i = 0; i < 3; i++) {
            this.reels.push({
                values: Array.from({length: 20}, (_, j) => j + 1),
                currentIndex: Math.floor(Math.random() * 20),
                spinSpeed: 0.1 + Math.random() * 0.15,
                stopping: false,
                stopFrame: 0
            });
        }
        
        // Initialize Keno balls (numbers 1-80 in a tumbler)
        this.kenoBalls = [];
        for (let i = 1; i <= 80; i++) {
            this.kenoBalls.push({
                number: i,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                radius: 18,
                selected: false,
                selectedTime: 0
            });
        }
        
        this.animate();
    }
    
    animate() {
        if (!this.isAnimating) return;
        
        const elapsed = Date.now() - this.startTime;
        const progress = elapsed / this.animationDuration;
        
        // Phase transitions
        if (progress < 0.4) {
            this.phase = 'slots';
        } else if (progress < 0.75) {
            this.phase = 'keno';
        } else {
            this.phase = 'reveal';
        }
        
        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.phase === 'slots') {
            this.drawSlotMachine(progress);
        } else if (this.phase === 'keno') {
            this.drawKenoTumbler(progress);
        } else {
            this.drawPowerballReveal();
        }
        
        this.frame++;
        
        if (progress >= 1) {
            this.isAnimating = false;
            this.showFinalResult();
        } else {
            requestAnimationFrame(() => this.animate());
        }
    }
    
    drawSlotMachine(progress) {
        const centerX = this.canvas.width / 2;
        const slotY = 150;
        const slotWidth = 250;
        const slotHeight = 200;
        const reelWidth = 80;
        const reelSpacing = 10;
        
        // Draw slot machine frame
        this.ctx.fillStyle = this.colors.slotBg;
        this.ctx.fillRect(centerX - slotWidth/2, slotY - slotHeight/2, slotWidth, slotHeight);
        
        // Draw border
        this.ctx.strokeStyle = this.colors.gold;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(centerX - slotWidth/2, slotY - slotHeight/2, slotWidth, slotHeight);
        
        // Draw reels
        this.reels.forEach((reel, reelIndex) => {
            const reelX = centerX - slotWidth/2 + 20 + reelIndex * (reelWidth + reelSpacing);
            const reelY = slotY - slotHeight/2 + 20;
            
            // Reel background
            this.ctx.fillStyle = this.colors.reelBg;
            this.ctx.fillRect(reelX, reelY, reelWidth, slotHeight - 40);
            
            // Spinning effect
            if (progress < 0.35) {
                reel.currentIndex = (reel.currentIndex + reel.spinSpeed) % reel.values.length;
            } else if (!reel.stopping) {
                reel.stopping = true;
                reel.stopFrame = this.frame;
            }
            
            // Draw visible numbers (3 visible positions)
            for (let i = -1; i <= 1; i++) {
                const index = Math.floor(reel.currentIndex + i + reel.values.length) % reel.values.length;
                const value = reel.values[index];
                const y = reelY + slotHeight/2 - 40 + i * 60;
                
                // Highlight center position
                if (i === 0) {
                    this.ctx.fillStyle = 'rgba(212, 175, 55, 0.2)';
                    this.ctx.fillRect(reelX, y - 25, reelWidth, 50);
                }
                
                // Draw number
                this.ctx.fillStyle = this.colors.text;
                this.ctx.font = 'bold 36px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(value, reelX + reelWidth/2, y);
            }
            
            // Reel border
            this.ctx.strokeStyle = this.colors.accent;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(reelX, reelY, reelWidth, slotHeight - 40);
        });
        
        // Draw "PEPEBALL" text above
        this.ctx.fillStyle = this.colors.gold;
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PEPEBALL', centerX, slotY - slotHeight/2 - 20);
    }
    
    drawKenoTumbler(progress) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const tumblerRadius = 180;
        
        // Draw tumbler/cage
        this.ctx.strokeStyle = this.colors.gold;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, tumblerRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw grid pattern inside
        this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(
                centerX + Math.cos(angle) * tumblerRadius,
                centerY + Math.sin(angle) * tumblerRadius
            );
            this.ctx.stroke();
        }
        
        // Animate balls tumbling
        const kenoProgress = (progress - 0.4) / 0.35;
        const numBallsToShow = Math.min(this.pepeCount, Math.floor(kenoProgress * this.pepeCount));
        
        // Select random balls
        const selectedBalls = [];
        for (let i = 0; i < numBallsToShow; i++) {
            if (!this.kenoBalls[i].selected) {
                this.kenoBalls[i].selected = true;
                this.kenoBalls[i].selectedTime = this.frame;
                
                // Random position in tumbler
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (tumblerRadius - 30);
                this.kenoBalls[i].x = centerX + Math.cos(angle) * radius;
                this.kenoBalls[i].y = centerY + Math.sin(angle) * radius;
            }
            
            if (this.kenoBalls[i].selected) {
                selectedBalls.push(this.kenoBalls[i]);
            }
        }
        
        // Draw selected balls
        selectedBalls.forEach((ball, idx) => {
            const age = this.frame - ball.selectedTime;
            const pulse = Math.sin(age * 0.2) * 3;
            
            // Ball color (white for most, blue for some, red for powerball)
            let ballColor = this.colors.ballWhite;
            let textColor = '#333';
            if (idx === selectedBalls.length - 1) {
                ballColor = this.colors.ballRed; // Powerball
                textColor = '#fff';
            } else if (idx % 5 === 0) {
                ballColor = this.colors.ballBlue;
                textColor = '#fff';
            }
            
            // Draw ball
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius + pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = ballColor;
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.gold;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw number
            this.ctx.fillStyle = textColor;
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(ball.number, ball.x, ball.y);
        });
        
        // Draw count
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Pepe Balls: ${numBallsToShow}`, centerX, centerY + tumblerRadius + 40);
    }
    
    drawPowerballReveal() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Draw large result display
        this.ctx.fillStyle = this.colors.slotBg;
        this.ctx.fillRect(centerX - 300, centerY - 100, 600, 200);
        
        // Border
        this.ctx.strokeStyle = this.isOdd ? this.colors.ballRed : this.colors.ballBlue;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(centerX - 300, centerY - 100, 600, 200);
        
        // Large number display
        this.ctx.fillStyle = this.colors.gold;
        this.ctx.font = 'bold 120px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.pepeCount, centerX, centerY - 20);
        
        // Result text
        const resultText = this.isOdd ? 'PAYOUT!' : 'ROLLOVER';
        const resultColor = this.isOdd ? this.colors.ballRed : this.colors.ballBlue;
        
        this.ctx.fillStyle = resultColor;
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillText(resultText, centerX, centerY + 60);
        
        // Draw balls on sides
        const ballSize = 40;
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            const radius = 120;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, ballSize, 0, Math.PI * 2);
            this.ctx.fillStyle = i === 4 ? this.colors.ballRed : this.colors.ballWhite;
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.gold;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    showFinalResult() {
        // Dispatch event for UI updates
        const event = new CustomEvent('drawComplete', {
            detail: {
                pepeCount: this.pepeCount,
                isOdd: this.isOdd,
                result: this.isOdd ? 'payout' : 'rollover'
            }
        });
        document.dispatchEvent(event);
        
        // Subtle confetti for payout
        if (this.isOdd) {
            this.subtleConfetti();
        }
    }
    
    subtleConfetti() {
        // Elegant confetti - not garish
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'absolute';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.top = '-10px';
                confetti.style.width = '8px';
                confetti.style.height = '8px';
                confetti.style.backgroundColor = [
                    this.colors.gold,
                    this.colors.ballBlue,
                    this.colors.ballRed,
                    this.colors.accent
                ][Math.floor(Math.random() * 4)];
                confetti.style.borderRadius = '50%';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                confetti.style.opacity = '0.8';
                confetti.style.animation = `confettiFall ${2 + Math.random()}s ease-out forwards`;
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 30);
        }
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
    
    .draw-animation-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 30px 0;
        padding: 20px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .draw-animation-canvas {
        border: 2px solid #d4af37;
        border-radius: 10px;
        background: #1a1a2e;
        box-shadow: 0 4px 20px rgba(212, 175, 55, 0.2);
    }
    
    .replay-btn {
        margin-top: 20px;
        padding: 14px 35px;
        background: linear-gradient(135deg, #2c5f8d 0%, #4a90a4 100%);
        color: #fff;
        border: 2px solid #d4af37;
        border-radius: 8px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        transition: all 0.3s;
        box-shadow: 0 4px 15px rgba(44, 95, 141, 0.3);
    }
    
    .replay-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(44, 95, 141, 0.5);
        background: linear-gradient(135deg, #4a90a4 0%, #2c5f8d 100%);
    }
    
    .replay-btn:active {
        transform: translateY(0);
    }
`;
document.head.appendChild(style);

// Export for global use
if (typeof window !== 'undefined') {
    window.DrawAnimation = DrawAnimation;
}
