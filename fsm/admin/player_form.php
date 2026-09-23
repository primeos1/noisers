<?php
// admin/player_form.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id   = getTeamId();
$action    = $_GET['action'] ?? 'add';
$player_id = $_GET['id'] ?? null;
$player    = null;
$error     = '';

$blood_types = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
$positions   = ['Goalkeeper','Defender','Midfielder','Forward'];
$feet        = ['Left','Right','Both'];

if ($action === 'edit' && $player_id) {
    $stmt = $pdo->prepare("SELECT * FROM players WHERE id = ? AND team_id = ?");
    $stmt->execute([$player_id, $team_id]);
    $player = $stmt->fetch();
    if (!$player) { header('Location: manage_players.php?error=player_not_found'); exit(); }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $full_name      = trim($_POST['full_name'] ?? '');
        $player_number  = !empty($_POST['player_number']) ? (int)$_POST['player_number'] : null;
        $position       = $_POST['position'] ?? null;
        $rating         = isset($_POST['rating']) ? (int)$_POST['rating'] : 3;
        $blood_type     = !empty($_POST['blood_type']) ? $_POST['blood_type'] : null;
        $health_issues  = trim($_POST['health_issues'] ?? '');
        $preferred_foot = !empty($_POST['preferred_foot']) ? $_POST['preferred_foot'] : null;
        $height         = !empty($_POST['height']) ? (float)$_POST['height'] : null;
        $weight         = !empty($_POST['weight']) ? (float)$_POST['weight'] : null;
        $goals          = isset($_POST['goals'])        ? (int)$_POST['goals']        : 0;
        $assists        = isset($_POST['assists'])       ? (int)$_POST['assists']       : 0;
        $yellow_cards   = isset($_POST['yellow_cards']) ? (int)$_POST['yellow_cards'] : 0;
        $red_cards      = isset($_POST['red_cards'])    ? (int)$_POST['red_cards']    : 0;
        $is_active      = isset($_POST['is_active']) ? 1 : 0;
        $camera_image   = $_POST['camera_image'] ?? '';

        $profile_image = $player['profile_image'] ?? null;

        if (isset($_FILES['profile_image']) && $_FILES['profile_image']['error'] === UPLOAD_ERR_OK) {
            $upload_dir = "../assets/uploads/teams/$team_id/players/";
            if (!file_exists($upload_dir)) mkdir($upload_dir, 0777, true);
            $file_ext = pathinfo($_FILES['profile_image']['name'], PATHINFO_EXTENSION);
            if (!in_array(strtolower($file_ext), ['jpg','jpeg','png','gif'])) throw new Exception("Only JPG, PNG, GIF allowed");
            if ($_FILES['profile_image']['size'] > 5*1024*1024) throw new Exception("File must be under 5MB");
            $filename = 'player_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . strtolower($file_ext);
            if ($action === 'edit' && $profile_image && file_exists($upload_dir.$profile_image)) unlink($upload_dir.$profile_image);
            if (move_uploaded_file($_FILES['profile_image']['tmp_name'], $upload_dir.$filename)) $profile_image = $filename;
            else throw new Exception("Failed to upload image");
        } elseif (!empty($camera_image)) {
            $upload_dir = "../assets/uploads/teams/$team_id/players/";
            if (!file_exists($upload_dir)) mkdir($upload_dir, 0777, true);
            $filename   = 'player_cam_' . time() . '_' . bin2hex(random_bytes(8)) . '.png';
            $image_data = base64_decode(str_replace([' ','data:image/png;base64,'], ['+',''], $camera_image));
            if ($action === 'edit' && $profile_image && file_exists($upload_dir.$profile_image)) unlink($upload_dir.$profile_image);
            if (file_put_contents($upload_dir.$filename, $image_data)) $profile_image = $filename;
            else throw new Exception("Failed to save camera image");
        }

        if ($action === 'edit' && $player_id) {
            $pdo->prepare("
                UPDATE players SET
                    full_name=?,player_number=?,position=?,rating=?,blood_type=?,
                    health_issues=?,preferred_foot=?,height=?,weight=?,
                    goals=?,assists=?,yellow_cards=?,red_cards=?,
                    profile_image=COALESCE(?,profile_image),is_active=?,updated_at=CURRENT_TIMESTAMP
                WHERE id=? AND team_id=?
            ")->execute([$full_name,$player_number,$position,$rating,$blood_type,
                         $health_issues,$preferred_foot,$height,$weight,
                         $goals,$assists,$yellow_cards,$red_cards,
                         $profile_image,$is_active,$player_id,$team_id]);
        } else {
            $pdo->prepare("
                INSERT INTO players (team_id,full_name,player_number,position,rating,blood_type,
                    health_issues,preferred_foot,height,weight,goals,assists,yellow_cards,red_cards,profile_image,is_active)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ")->execute([$team_id,$full_name,$player_number,$position,$rating,$blood_type,
                         $health_issues,$preferred_foot,$height,$weight,
                         $goals,$assists,$yellow_cards,$red_cards,$profile_image,$is_active]);
            $player_id = $pdo->lastInsertId();
        }

        $_SESSION['success_message'] = $action === 'edit' ? "Player updated." : "Player added.";
        header("Location: manage_players.php?success=1&id=$player_id");
        exit();
    } catch (Exception $e) {
        $error = $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo $action === 'edit' ? 'Edit Player' : 'Add Player'; ?> — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
</head>
<body>
<div class="page-shell">

    <aside class="sidebar">
        <div class="sidebar-brand">
            <a href="dashboard.php" class="sidebar-logo">NOISER FC <em>PRO</em></a>
            <div class="sidebar-team-name"><?php echo htmlspecialchars($_SESSION['team_name']); ?></div>
            <div class="sidebar-role-chip">Admin</div>
        </div>
        <nav class="sidebar-nav">
            <a href="dashboard.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Dashboard
            </a>
            <a href="manage_players.php" class="sidebar-link active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Players
            </a>
            <a href="create_match.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                New Match
            </a>
            <a href="randomize_sets.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                Manage Sets
            </a>
            <a href="match_management.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Live Matches
            </a>
            <a href="manage_cards.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                Cards
            </a>
            <div class="sidebar-divider"></div>
            <a href="reports.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Reports
            </a>
            <a href="settings.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
            </a>
            <div class="sidebar-divider"></div>
            <a href="../logout.php" class="sidebar-link" style="color:#f87171;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
            </a>
        </nav>
    </aside>

    <main class="main-area">
        <div class="page-hd">
            <div class="page-hd-row">
                <div>
                    <div class="page-title"><?php echo $action === 'edit' ? 'Edit Player' : 'Add Player'; ?></div>
                    <?php if ($action === 'edit' && $player): ?>
                    <div class="page-sub">#<?php echo $player['player_number']; ?> <?php echo htmlspecialchars($player['full_name']); ?></div>
                    <?php endif; ?>
                </div>
                <a href="manage_players.php" class="btn btn-ghost btn-sm">Back to Players</a>
            </div>
        </div>

        <?php if ($error): ?>
        <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <form method="POST" enctype="multipart/form-data" style="display:flex;flex-direction:column;gap:16px;max-width:780px;">
            <input type="hidden" name="camera_image" id="cameraImage">

            <!-- Photo -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Profile Photo</span></div>
                <div style="padding:20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
                    <div id="avatarWrap" style="width:88px;height:88px;border-radius:50%;overflow:hidden;background:var(--burg-900);border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:var(--burg-400);">
                        <?php
                        $imgPath = "../assets/uploads/teams/{$team_id}/players/" . ($player['profile_image'] ?? '');
                        if (!empty($player['profile_image']) && file_exists($imgPath)): ?>
                        <img id="previewImage" src="<?php echo htmlspecialchars($imgPath); ?>" alt="" style="width:100%;height:100%;object-fit:cover;">
                        <?php else: ?>
                        <span id="avatarInitial"><?php echo !empty($player['full_name']) ? strtoupper(substr($player['full_name'],0,1)) : '?'; ?></span>
                        <?php endif; ?>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <label class="btn btn-ghost btn-sm" style="cursor:pointer;">
                            Upload Photo
                            <input type="file" name="profile_image" id="profileImageInput" accept="image/*" style="display:none;" onchange="previewUpload(event)">
                        </label>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="openCamera()">Take Photo</button>
                    </div>
                </div>
            </div>

            <!-- Basic Info -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Basic Information</span></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                    <div class="form-grid form-grid-2">
                        <div>
                            <label class="field-label">Full Name <span style="color:#f87171;">*</span></label>
                            <input type="text" name="full_name" class="field" id="fullNameInput"
                                   value="<?php echo htmlspecialchars($player['full_name'] ?? ''); ?>"
                                   placeholder="Enter full name" required>
                        </div>
                        <div>
                            <label class="field-label">Jersey Number</label>
                            <input type="number" name="player_number" class="field" min="1" max="99"
                                   value="<?php echo htmlspecialchars($player['player_number'] ?? ''); ?>"
                                   placeholder="e.g. 7">
                        </div>
                        <div>
                            <label class="field-label">Position</label>
                            <select name="position" class="field">
                                <option value="">Select position</option>
                                <?php foreach ($positions as $pos): ?>
                                <option value="<?php echo $pos; ?>" <?php echo (($player['position'] ?? '') === $pos) ? 'selected' : ''; ?>><?php echo $pos; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label class="field-label">Preferred Foot</label>
                            <select name="preferred_foot" class="field">
                                <option value="">Select foot</option>
                                <?php foreach ($feet as $foot): ?>
                                <option value="<?php echo $foot; ?>" <?php echo (($player['preferred_foot'] ?? '') === $foot) ? 'selected' : ''; ?>><?php echo $foot; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rating -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Player Rating</span></div>
                <div style="padding:20px;">
                    <input type="hidden" name="rating" id="ratingValue" value="<?php echo $player['rating'] ?? 3; ?>">
                    <div style="display:flex;gap:6px;" id="starRow">
                        <?php for ($i = 1; $i <= 5; $i++): ?>
                        <span class="star-btn" data-val="<?php echo $i; ?>"
                              style="font-size:2rem;cursor:pointer;color:<?php echo $i <= ($player['rating'] ?? 3) ? '#fbbf24' : 'var(--pitch-500)'; ?>;">★</span>
                        <?php endfor; ?>
                    </div>
                    <div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;">Tap stars to set rating (1–5)</div>
                </div>
            </div>

            <!-- Physical & Health -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Physical &amp; Health</span></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                    <div class="form-grid form-grid-2">
                        <div>
                            <label class="field-label">Height (cm)</label>
                            <input type="number" name="height" class="field" step="0.01" min="100" max="250"
                                   value="<?php echo htmlspecialchars($player['height'] ?? ''); ?>" placeholder="180">
                        </div>
                        <div>
                            <label class="field-label">Weight (kg)</label>
                            <input type="number" name="weight" class="field" step="0.01" min="30" max="150"
                                   value="<?php echo htmlspecialchars($player['weight'] ?? ''); ?>" placeholder="75">
                        </div>
                        <div>
                            <label class="field-label">Blood Type</label>
                            <select name="blood_type" class="field">
                                <option value="">Select</option>
                                <?php foreach ($blood_types as $bt): ?>
                                <option value="<?php echo $bt; ?>" <?php echo (($player['blood_type'] ?? '') === $bt) ? 'selected' : ''; ?>><?php echo $bt; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="field-label">Health Notes / Medical Conditions</label>
                        <textarea name="health_issues" class="field" rows="3"
                                  placeholder="Allergies, injuries, medical conditions…"><?php echo htmlspecialchars($player['health_issues'] ?? ''); ?></textarea>
                    </div>
                </div>
            </div>

            <!-- Statistics -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Career Statistics</span></div>
                <div style="padding:20px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;">
                        <?php foreach ([
                            ['goals',        'Goals',        'var(--forest-400)'],
                            ['assists',      'Assists',      'var(--pitch-300)'],
                            ['yellow_cards', 'Yellow Cards', '#fbbf24'],
                            ['red_cards',    'Red Cards',    '#f87171'],
                        ] as [$field, $label, $color]): ?>
                        <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:7px;padding:12px;text-align:center;">
                            <input type="number" name="<?php echo $field; ?>" min="0"
                                   value="<?php echo $player[$field] ?? 0; ?>"
                                   style="width:100%;background:none;border:none;text-align:center;font-size:1.5rem;font-weight:800;color:<?php echo $color; ?>;font-family:'Jost',sans-serif;outline:none;">
                            <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-top:3px;"><?php echo $label; ?></div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <!-- Status -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Status</span></div>
                <div style="padding:16px 20px;">
                    <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
                        <input type="checkbox" name="is_active" value="1" class="check"
                               <?php echo (!isset($player) || ($player['is_active'] ?? 1)) ? 'checked' : ''; ?>>
                        <div>
                            <div style="font-weight:600;font-size:.875rem;">Active Player</div>
                            <div style="font-size:.75rem;color:var(--text-muted);">Inactive players won't appear in match squad selection</div>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
                <?php if ($action === 'edit' && $player_id): ?>
                <a href="manage_players.php?delete=1&id=<?php echo $player_id; ?>" class="btn btn-danger btn-sm"
                   onclick="return confirm('Delete this player? Cannot be undone.')">Delete</a>
                <?php endif; ?>
                <a href="manage_players.php" class="btn btn-ghost btn-sm">Cancel</a>
                <button type="submit" class="btn btn-primary btn-sm">
                    <?php echo $action === 'edit' ? 'Update Player' : 'Add Player'; ?>
                </button>
            </div>
        </form>
    </main>
</div>

<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
        </a>
        <a href="manage_players.php" class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Players
        </a>
        <a href="match_management.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Matches
        </a>
        <a href="randomize_sets.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            Sets
        </a>
        <a href="reports.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<!-- Camera Modal -->
<div id="cameraModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--pitch-800);border:1px solid var(--border);border-radius:10px;width:100%;max-width:560px;">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;">Take Photo</span>
            <button onclick="closeCamera()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.3rem;">×</button>
        </div>
        <div style="padding:16px;">
            <div style="background:#000;border-radius:8px;overflow:hidden;">
                <video id="cameraVideo" autoplay style="width:100%;max-height:360px;display:block;object-fit:cover;"></video>
                <canvas id="cameraCanvas" width="640" height="480" style="display:none;"></canvas>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                <button type="button" class="btn btn-ghost btn-sm" onclick="closeCamera()">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="capturePhoto()">Capture</button>
            </div>
        </div>
    </div>
</div>

<script>
// Star rating
document.querySelectorAll('.star-btn').forEach(function(star) {
    star.addEventListener('click', function() {
        var val = parseInt(this.dataset.val);
        document.getElementById('ratingValue').value = val;
        document.querySelectorAll('.star-btn').forEach(function(s, i) {
            s.style.color = (i < val) ? '#fbbf24' : 'var(--pitch-500)';
        });
    });
});

document.getElementById('fullNameInput').addEventListener('input', function() {
    var initial = document.getElementById('avatarInitial');
    if (initial) initial.textContent = this.value.trim().charAt(0).toUpperCase() || '?';
});

function previewUpload(event) {
    if (!event.target.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) { updateAvatar(e.target.result); };
    reader.readAsDataURL(event.target.files[0]);
}

function updateAvatar(src) {
    document.getElementById('avatarWrap').innerHTML = '<img src="' + src + '" alt="" style="width:100%;height:100%;object-fit:cover;">';
}

var cameraStream = null;
function openCamera() {
    document.getElementById('cameraModal').style.display = 'flex';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(function(stream) {
            cameraStream = stream;
            document.getElementById('cameraVideo').srcObject = stream;
        })
        .catch(function(err) { alert('Camera error: ' + err.message); closeCamera(); });
}
function closeCamera() {
    document.getElementById('cameraModal').style.display = 'none';
    if (cameraStream) { cameraStream.getTracks().forEach(function(t){ t.stop(); }); cameraStream = null; }
    document.getElementById('cameraVideo').srcObject = null;
}
function capturePhoto() {
    var canvas = document.getElementById('cameraCanvas');
    canvas.getContext('2d').drawImage(document.getElementById('cameraVideo'), 0, 0, 640, 480);
    var data = canvas.toDataURL('image/png');
    document.getElementById('cameraImage').value = data;
    document.getElementById('profileImageInput').value = '';
    updateAvatar(data);
    closeCamera();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCamera();
});
</script>
</body>
</html>
