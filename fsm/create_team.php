<?php
session_start();
require_once 'includes/db_connection.php';

// Redirect if already logged in
if (isset($_SESSION['team_id'])) {
    header('Location: ' . ($_SESSION['role'] === 'admin' ? 'admin/dashboard.php' : 'player/dashboard.php'));
    exit();
}

$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $team_name = trim($_POST['team_name']);
    $admin_password = $_POST['admin_password'];
    $player_password = $_POST['player_password'];
    $confirm_admin_password = $_POST['confirm_admin_password'];
    $confirm_player_password = $_POST['confirm_player_password'];
    
    // Generate unique team code
    $team_code = generateTeamCode($team_name);
    
    // Validate passwords
    if ($admin_password !== $confirm_admin_password) {
        $error = 'Admin passwords do not match';
    } elseif ($player_password !== $confirm_player_password) {
        $error = 'Player passwords do not match';
    } elseif (strlen($admin_password) < 6 || strlen($player_password) < 6) {
        $error = 'Passwords must be at least 6 characters long';
    } else {
        try {
            // Check if team name already exists
            $stmt = $pdo->prepare("SELECT id FROM teams WHERE team_name = ?");
            $stmt->execute([$team_name]);
            
            if ($stmt->rowCount() > 0) {
                $error = 'Team name already exists. Please choose another name.';
            } else {
                // Insert new team
                $hashed_admin_password = password_hash($admin_password, PASSWORD_DEFAULT);
                $hashed_player_password = password_hash($player_password, PASSWORD_DEFAULT);
                
                $stmt = $pdo->prepare("INSERT INTO teams (team_name, team_code, admin_password, player_password) 
                                     VALUES (?, ?, ?, ?)");
                $stmt->execute([$team_name, $team_code, $hashed_admin_password, $hashed_player_password]);
                
                $team_id = $pdo->lastInsertId();
                
                // Create session and redirect to admin dashboard
                $_SESSION['team_id'] = $team_id;
                $_SESSION['team_name'] = $team_name;
                $_SESSION['team_code'] = $team_code;
                $_SESSION['role'] = 'admin';
                
                // Create necessary folders for team
                createTeamFolders($team_id);
                
                $success = "Team created successfully! Your team code is: <strong>$team_code</strong>";
                header('refresh:3;url=admin/dashboard.php');
            }
        } catch (PDOException $e) {
            $error = 'Database error: ' . $e->getMessage();
        }
    }
}

function generateTeamCode($team_name) {
    $initials = '';
    $words = explode(' ', $team_name);
    
    foreach ($words as $word) {
        if (strlen($word) > 0) {
            $initials .= strtoupper($word[0]);
        }
    }
    
    // Add random numbers
    $random = rand(100, 999);
    return $initials . $random;
}

function createTeamFolders($team_id) {
    $folders = [
        "assets/uploads/teams/$team_id/players",
        "assets/uploads/teams/$team_id/matches"
    ];
    
    foreach ($folders as $folder) {
        if (!file_exists($folder)) {
            mkdir($folder, 0777, true);
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create New Team - Noisers Football Pro</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .create-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 500px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .back-link {
            margin-bottom: 20px;
        }
        
        .back-link a {
            color: #00b4db;
            text-decoration: none;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .back-link a:hover {
            text-decoration: underline;
        }
        
        h2 {
            color: #fff;
            margin-bottom: 5px;
            text-align: center;
        }
        
        .subtitle {
            color: #8a8a8a;
            text-align: center;
            margin-bottom: 30px;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            color: #fff;
            margin-bottom: 8px;
            font-size: 0.9rem;
        }
        
        .input-with-icon {
            position: relative;
        }
        
        input {
            width: 100%;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            color: #fff;
            font-size: 1rem;
            transition: all 0.3s ease;
            padding-left: 45px;
        }
        
        .input-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: #8a8a8a;
        }
        
        input:focus {
            outline: none;
            border-color: #00b4db;
            box-shadow: 0 0 0 2px rgba(0, 180, 219, 0.2);
        }
        
        .password-strength {
            display: flex;
            gap: 5px;
            margin-top: 5px;
        }
        
        .strength-bar {
            flex: 1;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            transition: all 0.3s ease;
        }
        
        .create-btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(45deg, #00b4db, #0083b0);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            margin-top: 10px;
        }
        
        .create-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 180, 219, 0.4);
        }
        
        .success-message {
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid #4CAF50;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            color: #4CAF50;
            text-align: center;
        }
        
        .error-message {
            background: rgba(255, 87, 87, 0.1);
            border: 1px solid #ff5757;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            color: #ff5757;
            text-align: center;
        }
        
        .info-box {
            background: rgba(0, 180, 219, 0.1);
            border: 1px solid #00b4db;
            border-radius: 10px;
            padding: 15px;
            margin-top: 20px;
        }
        
        .info-box h4 {
            color: #00b4db;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .info-box ul {
            color: #8a8a8a;
            font-size: 0.9rem;
            padding-left: 20px;
        }
        
        .info-box li {
            margin-bottom: 5px;
        }
        
        @media (max-width: 480px) {
            .create-container {
                padding: 30px 20px;
            }
            
            .password-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="create-container">
        <div class="back-link">
            <a href="index.php">← Back to Login</a>
        </div>
        
        <h2>Create New Team</h2>
        <p class="subtitle">Set up your football team management system</p>
        
        <?php if ($success): ?>
            <div class="success-message">
                <?php echo $success; ?>
                <p>Redirecting to admin dashboard...</p>
            </div>
        <?php endif; ?>
        
        <?php if ($error): ?>
            <div class="error-message">
                <?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>
        
        <form method="POST" action="" id="teamForm">
            <div class="form-group">
                <label for="team_name">Team Name</label>
                <div class="input-with-icon">
                    <span class="input-icon">🏆</span>
                    <input type="text" id="team_name" name="team_name" 
                           placeholder="Enter your team name" 
                           required
                           value="<?php echo isset($_POST['team_name']) ? htmlspecialchars($_POST['team_name']) : ''; ?>">
                </div>
            </div>
            
            <div class="form-group">
                <label for="admin_password">Admin Password</label>
                <div class="input-with-icon">
                    <span class="input-icon">🔐</span>
                    <input type="password" id="admin_password" name="admin_password" 
                           placeholder="Enter admin password" 
                           required
                           minlength="6">
                </div>
                <div class="password-strength" id="admin-strength">
                    <div class="strength-bar"></div>
                    <div class="strength-bar"></div>
                    <div class="strength-bar"></div>
                    <div class="strength-bar"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="confirm_admin_password">Confirm Admin Password</label>
                <div class="input-with-icon">
                    <span class="input-icon">✅</span>
                    <input type="password" id="confirm_admin_password" name="confirm_admin_password" 
                           placeholder="Confirm admin password" 
                           required>
                </div>
            </div>
            
            <div class="form-group">
                <label for="player_password">Player Password</label>
                <div class="input-with-icon">
                    <span class="input-icon">👥</span>
                    <input type="password" id="player_password" name="player_password" 
                           placeholder="Enter player password" 
                           required
                           minlength="6">
                </div>
                <div class="password-strength" id="player-strength">
                    <div class="strength-bar"></div>
                    <div class="strength-bar"></div>
                    <div class="strength-bar"></div>
                    <div class="strength-bar"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="confirm_player_password">Confirm Player Password</label>
                <div class="input-with-icon">
                    <span class="input-icon">✅</span>
                    <input type="password" id="confirm_player_password" name="confirm_player_password" 
                           placeholder="Confirm player password" 
                           required>
                </div>
            </div>
            
            <button type="submit" class="create-btn">Create Team & Continue</button>
        </form>
        
        <div class="info-box">
            <h4>📝 Important Information</h4>
            <ul>
                <li>Admin password is for team management</li>
                <li>Player password is for players to view their stats</li>
                <li>Keep your team code secure - you'll need it for login</li>
                <li>You can add players after creating the team</li>
            </ul>
        </div>
    </div>

    <script>
        // Password strength checker
        function checkPasswordStrength(password) {
            let strength = 0;
            
            if (password.length >= 6) strength++;
            if (password.length >= 8) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;
            
            return Math.min(strength, 4);
        }
        
        function updateStrengthBars(password, strengthId) {
            const strength = checkPasswordStrength(password);
            const bars = document.querySelectorAll(`#${strengthId} .strength-bar`);
            
            bars.forEach((bar, index) => {
                if (index < strength) {
                    let color;
                    switch(strength) {
                        case 1: color = '#ff5757'; break;
                        case 2: color = '#ffa857'; break;
                        case 3: color = '#ffd357'; break;
                        case 4: color = '#4CAF50'; break;
                        default: color = '#8a8a8a';
                    }
                    bar.style.background = color;
                } else {
                    bar.style.background = 'rgba(255, 255, 255, 0.1)';
                }
            });
        }
        
        document.getElementById('admin_password').addEventListener('input', function(e) {
            updateStrengthBars(e.target.value, 'admin-strength');
        });
        
        document.getElementById('player_password').addEventListener('input', function(e) {
            updateStrengthBars(e.target.value, 'player-strength');
        });
        
        // Form validation
        document.getElementById('teamForm').addEventListener('submit', function(e) {
            const adminPass = document.getElementById('admin_password').value;
            const confirmAdminPass = document.getElementById('confirm_admin_password').value;
            const playerPass = document.getElementById('player_password').value;
            const confirmPlayerPass = document.getElementById('confirm_player_password').value;
            
            if (adminPass !== confirmAdminPass) {
                e.preventDefault();
                alert('Admin passwords do not match!');
                return false;
            }
            
            if (playerPass !== confirmPlayerPass) {
                e.preventDefault();
                alert('Player passwords do not match!');
                return false;
            }
            
            if (adminPass.length < 6 || playerPass.length < 6) {
                e.preventDefault();
                alert('Passwords must be at least 6 characters long');
                return false;
            }
        });
    </script>
</body>
</html>