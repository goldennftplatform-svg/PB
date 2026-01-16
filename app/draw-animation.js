// Slot Machine + Keno + Powerball Hybrid Draw Animation
// Professional casino aesthetic with muted colors

class DrawAnimation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 900;
        this.canvas.height = 500;
        
        // Anon/Green Terminal Colors
        this.colors = {
            background: '#0d1117',
            slotBg: '#161b22',
            reelBg: '#1c2128',
            ballWhite: '#c9d1d9',
            ballBlue: '#58a6ff',
            ballRed: '#f85149',
            green: '#00ff41',
            greenDark: '#00cc33',
            text: '#c9d1d9',
            accent: '#00ff41'
        };
        
        this.reels = [];
        this.kenoBalls = [];
        this.pepeCount = 0;
        this.isOdd = false;
        this.isAnimating = false;
        this.phase = 'slots'; // 'slots' -> 'keno' -> 'reveal'
        this.frame = 0;
        this.startTime = 0;
        this.animationDuration = 7000; // 7 seconds total (longer for 6 reels)
    }
    
    startAnimation(pepeCount) {
        if (this.isAnimating) return;
        
        this.pepeCount = pepeCount || (Math.floor(Math.random() * 30) + 1);
        this.isOdd = this.pepeCount % 2 === 1;
        this.isAnimating = true;
        this.frame = 0;
        this.startTime = Date.now();
        this.phase = 'slots';
        
        // Initialize slot reels (6 reels showing numbers 1-69 for Powerball)
        this.reels = [];
        for (let i = 0; i < 6; i++) {
            this.reels.push({
                values: Array.from({length: 69}, (_, j) => j + 1),
                currentIndex: Math.floor(Math.random() * 69),
                spinSpeed: 0.15 + Math.random() * 0.2,
                stopping: false,
                stopFrame: 0,
                finalValue: null
            });
        }
        
        // Set final values for each reel (will be revealed when stopping)
        const winningNumbers = [];
        for (let i = 0; i < 5; i++) {
            winningNumbers.push(Math.floor(Math.random() * 69) + 1);
        }
        winningNumbers.sort((a, b) => a - b);
        winningNumbers.push(Math.floor(Math.random() * 26) + 1); // Powerball (1-26)
        
        this.reels.forEach((reel, idx) => {
            reel.finalValue = winningNumbers[idx];
        });
        
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
        
        // Phase transitions - longer slot phase for 6 reels
        if (progress < 0.5) {
            this.phase = 'slots';
        } else if (progress < 0.8) {
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
        const slotY = 200;
        const numReels = 6;
        const reelWidth = 70;
        const reelSpacing = 8;
        const slotHeight = 180;
        const totalWidth = (numReels * reelWidth) + ((numReels - 1) * reelSpacing) + 40;
        
        // Draw slot machine frame with sharp edges
        this.ctx.fillStyle = this.colors.slotBg;
        this.ctx.fillRect(centerX - totalWidth/2, slotY - slotHeight/2, totalWidth, slotHeight);
        
        // Sharp border with glow
        this.ctx.strokeStyle = this.colors.green;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = this.colors.green;
        this.ctx.shadowBlur = 15;
        this.ctx.strokeRect(centerX - totalWidth/2, slotY - slotHeight/2, totalWidth, slotHeight);
        this.ctx.shadowBlur = 0;
        
        // Draw 6 reels
        this.reels.forEach((reel, reelIndex) => {
            const reelX = centerX - totalWidth/2 + 20 + reelIndex * (reelWidth + reelSpacing);
            const reelY = slotY - slotHeight/2 + 20;
            
            // Reel background - sharp rectangle
            this.ctx.fillStyle = this.colors.reelBg;
            this.ctx.fillRect(reelX, reelY, reelWidth, slotHeight - 40);
            
            // Determine if this reel should stop (staggered stopping)
            const stopProgress = 0.25 + (reelIndex * 0.05);
            const isPowerball = reelIndex === 5;
            
            // Spinning effect
            if (progress < stopProgress) {
                reel.currentIndex = (reel.currentIndex + reel.spinSpeed) % reel.values.length;
            } else if (!reel.stopping) {
                reel.stopping = true;
                reel.stopFrame = this.frame;
                // Snap to final value
                reel.currentIndex = reel.values.indexOf(reel.finalValue);
            }
            
            // Draw visible numbers (3 visible positions for depth)
            for (let i = -1; i <= 1; i++) {
                const index = Math.floor(reel.currentIndex + i + reel.values.length) % reel.values.length;
                const value = reel.values[index];
                const y = reelY + slotHeight/2 - 30 + i * 50;
                const opacity = 1 - Math.abs(i) * 0.4;
                
                // Highlight center position with sharp rectangle
                if (i === 0) {
                    this.ctx.fillStyle = isPowerball ? 'rgba(0, 255, 65, 0.3)' : 'rgba(0, 255, 65, 0.15)';
                    this.ctx.fillRect(reelX + 2, y - 22, reelWidth - 4, 44);
                }
                
                // Draw number - sharp and clear
                this.ctx.fillStyle = i === 0 
                    ? (isPowerball ? this.colors.green : this.colors.green)
                    : `rgba(201, 209, 217, ${opacity})`;
                this.ctx.font = isPowerball 
                    ? 'bold 32px "Courier New", monospace'
                    : 'bold 28px "Courier New", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(value, reelX + reelWidth/2, y);
            }
            
            // Sharp reel border
            this.ctx.strokeStyle = isPowerball ? this.colors.green : 'rgba(0, 255, 65, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(reelX, reelY, reelWidth, slotHeight - 40);
            
            // Powerball indicator
            if (isPowerball) {
                this.ctx.fillStyle = 'rgba(0, 255, 65, 0.1)';
                this.ctx.fillRect(reelX, reelY - 15, reelWidth, 12);
                this.ctx.fillStyle = this.colors.green;
                this.ctx.font = 'bold 10px "Courier New", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('PB', reelX + reelWidth/2, reelY - 5);
            }
        });
        
        // Sharp "PEPEBALL" title
        this.ctx.fillStyle = this.colors.green;
        this.ctx.font = 'bold 36px "Courier New", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = this.colors.green;
        this.ctx.shadowBlur = 20;
        this.ctx.fillText('PEPEBALL DRAW', centerX, slotY - slotHeight/2 - 15);
        this.ctx.shadowBlur = 0;
    }
    
    drawKenoTumbler(progress) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const tumblerRadius = 180;
        
        // Draw tumbler/cage
        this.ctx.strokeStyle = this.colors.green;
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = this.colors.green;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, tumblerRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Draw grid pattern inside
        this.ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
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
        const kenoProgress = (progress - 0.5) / 0.3;
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
            
            // Ball color (green theme)
            let ballColor = this.colors.ballWhite;
            let textColor = '#0d1117';
            if (idx === selectedBalls.length - 1) {
                ballColor = this.colors.green; // Powerball
                textColor = '#0d1117';
            } else if (idx % 5 === 0) {
                ballColor = this.colors.greenDark;
                textColor = '#fff';
            }
            
            // Draw ball
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius + pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = ballColor;
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.green;
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = this.colors.green;
            this.ctx.shadowBlur = 3;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Draw number
            this.ctx.fillStyle = textColor;
            this.ctx.font = 'bold 16px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(ball.number, ball.x, ball.y);
        });
        
        // Draw count
        this.ctx.fillStyle = this.colors.green;
        this.ctx.font = 'bold 24px "Courier New", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = this.colors.green;
        this.ctx.shadowBlur = 10;
        this.ctx.fillText(`Pepe Balls: ${numBallsToShow}`, centerX, centerY + tumblerRadius + 40);
        this.ctx.shadowBlur = 0;
    }
    
    drawPowerballReveal() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Display the 6 winning numbers in a clean row
        const numReels = 6;
        const ballSize = 55;
        const ballSpacing = 15;
        const totalWidth = (numReels * ballSize) + ((numReels - 1) * ballSpacing);
        const startX = centerX - totalWidth / 2;
        
        // Draw each winning number as a ball
        this.reels.forEach((reel, idx) => {
            const x = startX + idx * (ballSize + ballSpacing) + ballSize / 2;
            const y = centerY - 40;
            const isPowerball = idx === 5;
            
            // Ball background
            this.ctx.beginPath();
            this.ctx.arc(x, y, ballSize / 2, 0, Math.PI * 2);
            this.ctx.fillStyle = isPowerball ? this.colors.green : this.colors.ballWhite;
            this.ctx.fill();
            
            // Sharp border with glow
            this.ctx.strokeStyle = this.colors.green;
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = this.colors.green;
            this.ctx.shadowBlur = isPowerball ? 15 : 8;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Number text - sharp and clear
            this.ctx.fillStyle = isPowerball ? this.colors.background : this.colors.green;
            this.ctx.font = isPowerball 
                ? 'bold 28px "Courier New", monospace'
                : 'bold 24px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(reel.finalValue || reel.values[reel.currentIndex], x, y);
        });
        
        // Result text - sharp
        const resultText = this.isOdd ? 'PAYOUT!' : 'ROLLOVER';
        this.ctx.fillStyle = this.colors.green;
        this.ctx.font = 'bold 42px "Courier New", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = this.colors.green;
        this.ctx.shadowBlur = 20;
        this.ctx.fillText(resultText, centerX, centerY + 80);
        this.ctx.shadowBlur = 0;
        
        // Pepe count display
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 20px "Courier New", monospace';
        this.ctx.fillText(`Pepe Balls: ${this.pepeCount}`, centerX, centerY + 120);
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
        border: 2px solid #00ff41;
        border-radius: 4px;
        background: #0d1117;
        box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
    }
    
    .replay-btn {
        margin-top: 20px;
        padding: 14px 35px;
        background: #161b22;
        color: #00ff41;
        border: 2px solid #00ff41;
        border-radius: 4px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        transition: all 0.3s;
        box-shadow: 0 0 15px rgba(0, 255, 65, 0.3);
        font-family: 'Courier New', monospace;
    }
    
    .replay-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 25px rgba(0, 255, 65, 0.6);
        background: rgba(0, 255, 65, 0.1);
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
