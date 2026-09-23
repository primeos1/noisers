<?php
session_start();
require_once 'includes/db_connection.php';

if (isset($_SESSION['team_id']) && isset($_SESSION['role'])) {
    header('Location: ' . ($_SESSION['role'] === 'admin' ? 'admin/dashboard.php' : 'player/dashboard.php'));
    exit();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $team_code = trim($_POST['team_code']);
    $password  = $_POST['password'];
    $role      = $_POST['role'];

    try {
        $stmt = $pdo->prepare("SELECT * FROM teams WHERE team_code = ?");
        $stmt->execute([$team_code]);
        $team = $stmt->fetch();

        if ($team) {
            $correct = ($role === 'admin') ? $team['admin_password'] : $team['player_password'];
            if (password_verify($password, $correct)) {
                $_SESSION['team_id']   = $team['id'];
                $_SESSION['team_name'] = $team['team_name'];
                $_SESSION['team_code'] = $team['team_code'];
                $_SESSION['role']      = $role;
                header('Location: ' . ($role === 'admin' ? 'admin/dashboard.php' : 'player/dashboard.php'));
                exit();
            } else { $error = 'Incorrect credentials'; }
        } else { $error = 'Team not found'; }
    } catch (PDOException $e) { $error = 'System error — please try again'; }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Noisers Football Pro — Sign In</title>
    <?php include 'includes/head.php'; ?>
    <style>
        body { font-family: 'Jost', sans-serif; }

        /* ── Pitch background ── */
        .pitch-wrap {
            position: fixed;
            inset: 0;
            z-index: 0;
            overflow: hidden;
        }
        .pitch-wrap svg {
            width: 100%;
            height: 100%;
        }
        .pitch-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(
                160deg,
                rgba(0, 0, 8, 0.65) 0%,
                rgba(0, 14, 4, 0.40) 50%,
                rgba(0, 0, 8, 0.65) 100%
            );
        }

        /* ── Page shell ── */
        .login-bg {
            position: relative;
            z-index: 1;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 16px 40px;
        }

        /* ── Card (frosted glass over grass) ── */
        .login-card {
            width: 100%;
            max-width: 380px;
            background: rgba(16, 16, 20, 0.88);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 12px;
            padding: 36px 28px 32px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.55);
        }

        .brand-mark {
            font-size: 2.8rem;
            font-weight: 900;
            letter-spacing: -.04em;
            line-height: 1;
            color: #f0f0f4;
            text-align: center;
        }
        .brand-mark span { color: #c23055; }

        .brand-sub {
            font-size: 0.62rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .2em;
            color: #4a4a54;
            text-align: center;
            margin-top: 7px;
            margin-bottom: 28px;
        }

        .error-box {
            background: rgba(220,38,38,.1);
            border: 1px solid rgba(220,38,38,.18);
            color: #f87171;
            padding: 10px 13px;
            border-radius: 6px;
            font-size: 0.82rem;
            font-weight: 600;
            margin-bottom: 20px;
        }

        /* Role switcher */
        .role-toggle {
            display: flex;
            background: rgba(0,0,0,0.35);
            border: 1px solid #34343c;
            border-radius: 7px;
            padding: 3px;
            gap: 3px;
            margin-bottom: 22px;
        }
        .role-toggle input { display: none; }
        .role-toggle label {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
            border-radius: 5px;
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .09em;
            cursor: pointer;
            color: #4a4a54;
            transition: background .18s, color .18s;
        }
        #role-player:checked ~ .role-toggle-bg-player,
        .role-toggle input:checked + label {
            background: #7c1d35;
            color: #f0f0f4;
        }
        #role-admin:checked + label { background: #2d6a4f; color: #f0f0f4; }

        /* Inputs */
        .f-label {
            display: block;
            font-size: 0.67rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .09em;
            color: #6b6b78;
            margin-bottom: 6px;
        }
        .f-input {
            width: 100%;
            background: rgba(0,0,0,0.35);
            border: 1px solid #34343c;
            color: #f0f0f4;
            font-family: 'Jost', sans-serif;
            font-size: 0.925rem;
            font-weight: 500;
            padding: 12px 14px;
            border-radius: 7px;
            outline: none;
            transition: border-color .18s;
            min-height: 46px;
        }
        .f-input:focus { border-color: #7c1d35; }
        .f-input::placeholder { color: #34343c; }

        /* Submit */
        .submit-btn {
            width: 100%;
            background: #7c1d35;
            color: #f0f0f4;
            font-family: 'Jost', sans-serif;
            font-size: 0.825rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .12em;
            padding: 14px;
            border: none;
            border-radius: 7px;
            cursor: pointer;
            transition: background .18s;
            min-height: 50px;
            margin-top: 6px;
        }
        .submit-btn:hover    { background: #9e2542; }
        .submit-btn:active   { background: #5a1526; }
        .submit-btn:disabled { opacity: .6; cursor: not-allowed; }

        /* Install bar */
        .install-bar {
            width: 100%;
            max-width: 380px;
            background: rgba(16, 16, 20, 0.88);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 8px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .install-bar-title  { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #c0c0cc; }
        .install-bar-desc   { font-size: 0.75rem; color: #4a4a54; margin-top: 1px; }
        .install-bar-btn {
            background: #7c1d35; color: #f0f0f4;
            font-family: 'Jost', sans-serif; font-size: 0.72rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: .07em;
            padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer;
            white-space: nowrap;
        }
        .install-bar-close {
            background: none; border: none; color: #4a4a54;
            cursor: pointer; font-size: 1rem; padding: 2px; line-height: 1;
            margin-left: auto;
        }

        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .animate-up { animation: fadeUp .35s ease-out; }
    </style>
</head>
<body class="login-bg">

    <!-- Football pitch background -->
    <div class="pitch-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 680" preserveAspectRatio="xMidYMid slice">
            <!-- Base grass -->
            <rect width="1050" height="680" fill="#2a7230"/>
            <!-- Alternating vertical stripes -->
            <rect x="0"   width="150" height="680" fill="#226228" opacity="0.65"/>
            <rect x="300" width="150" height="680" fill="#226228" opacity="0.65"/>
            <rect x="600" width="150" height="680" fill="#226228" opacity="0.65"/>
            <rect x="900" width="150" height="680" fill="#226228" opacity="0.65"/>
            <!-- Field lines -->
            <g stroke="rgba(255,255,255,0.85)" stroke-width="2.5" fill="none">
                <!-- Boundary -->
                <rect x="25" y="20" width="1000" height="640"/>
                <!-- Halfway line -->
                <line x1="525" y1="20" x2="525" y2="660"/>
                <!-- Centre circle -->
                <circle cx="525" cy="340" r="87"/>
                <!-- Left penalty area (16.5m deep × 40.32m wide) -->
                <rect x="25" y="150" width="157" height="380"/>
                <!-- Left goal area (5.5m deep × 18.32m wide) -->
                <rect x="25" y="254" width="52" height="172"/>
                <!-- Left penalty arc -->
                <path d="M 182 270 A 87 87 0 0 1 182 410"/>
                <!-- Right penalty area -->
                <rect x="868" y="150" width="157" height="380"/>
                <!-- Right goal area -->
                <rect x="973" y="254" width="52" height="172"/>
                <!-- Right penalty arc -->
                <path d="M 868 270 A 87 87 0 0 0 868 410"/>
                <!-- Corner arcs -->
                <path d="M 25 35  A 15 15 0 0 1 40  20"/>
                <path d="M 1010 20  A 15 15 0 0 1 1025 35"/>
                <path d="M 1025 645 A 15 15 0 0 1 1010 660"/>
                <path d="M 40  660 A 15 15 0 0 1 25  645"/>
            </g>
            <!-- Spots -->
            <circle cx="525" cy="340" r="4" fill="rgba(255,255,255,0.85)"/>
            <circle cx="130" cy="340" r="4" fill="rgba(255,255,255,0.85)"/>
            <circle cx="920" cy="340" r="4" fill="rgba(255,255,255,0.85)"/>
            <!-- Goals -->
            <g stroke="rgba(255,255,255,0.55)" stroke-width="2" fill="none">
                <rect x="14"  y="306" width="11" height="68"/>
                <rect x="1025" y="306" width="11" height="68"/>
            </g>
        </svg>
        <div class="pitch-overlay"></div>
    </div>

    <!-- PWA Install Banner -->
    <div id="installBar" class="install-bar animate-up" style="display:none;">
        <div style="flex:1;min-width:0;">
            <div class="install-bar-title">Noisers Football Pro</div>
            <div class="install-bar-desc">Install for faster access</div>
        </div>
        <button class="install-bar-btn" id="installBtn">Install</button>
        <button class="install-bar-close" onclick="this.parentElement.style.display='none'">✕</button>
    </div>

    <!-- Login Card -->
    <div class="login-card animate-up">

        <div class="brand-mark">NOISER FC <span>PRO</span></div>
        <div class="brand-sub">5-A-Side Tactical Suite</div>

        <?php if ($error): ?>
        <div class="error-box"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <form method="POST" id="loginForm">

            <!-- Role toggle -->
            <div class="role-toggle">
                <input type="radio" id="role-player" name="role" value="player" checked>
                <label for="role-player">Player</label>
                <input type="radio" id="role-admin" name="role" value="admin">
                <label for="role-admin">Manager</label>
            </div>

            <!-- Team Code -->
            <div style="margin-bottom:14px;">
                <label class="f-label" for="team_code">Team Code</label>
                <input class="f-input" id="team_code" type="text" name="team_code"
                       placeholder="e.g. TM2025" autocomplete="off" required>
            </div>

            <!-- Password -->
            <div style="margin-bottom:22px;">
                <label class="f-label" for="password">Password</label>
                <input class="f-input" id="password" type="password" name="password"
                       placeholder="••••••••" required>
            </div>

            <button type="submit" class="submit-btn" id="submitBtn">
                <span id="btnText">Enter Pitch</span>
            </button>

        </form>
    </div>

    <script>
    // PWA install prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('installBar').style.display = 'flex';
    });
    document.getElementById('installBtn')?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') document.getElementById('installBar').style.display = 'none';
        deferredPrompt = null;
    });
    window.addEventListener('appinstalled', () => {
        document.getElementById('installBar').style.display = 'none';
    });

    // Role toggle changes button label
    document.querySelectorAll('input[name="role"]').forEach(r => {
        r.addEventListener('change', () => {
            document.getElementById('btnText').textContent =
                r.value === 'admin' ? 'Authorize' : 'Enter Pitch';
        });
    });

    // Loading state on submit
    document.getElementById('loginForm').addEventListener('submit', () => {
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        document.getElementById('btnText').textContent = 'Connecting…';
    });

    // Service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
    </script>
</body>
</html>
