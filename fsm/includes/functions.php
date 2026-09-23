// includes/functions.php
function randomizeSetsWithRating($players, $setsCount, $evenDistribution = true) {
    if ($evenDistribution) {
        // Separate players by rating
        $highRated = array_filter($players, function($p) { return $p['rating'] >= 4; });
        $otherPlayers = array_filter($players, function($p) { return $p['rating'] < 4; });
        
        // Distribute high-rated players evenly
        $sets = array_fill(0, $setsCount, []);
        $i = 0;
        foreach ($highRated as $player) {
            $sets[$i % $setsCount][] = $player;
            $i++;
        }
        
        // Add remaining players
        shuffle($otherPlayers);
        foreach ($otherPlayers as $player) {
            // Find set with fewest players
            usort($sets, function($a, $b) { return count($a) - count($b); });
            $sets[0][] = $player;
        }
    } else {
        // Simple random distribution
        shuffle($players);
        $sets = array_chunk($players, ceil(count($players) / $setsCount));
    }
    
    return $sets;
}
<?php
// includes/functions.php

/**
 * Generate player statistics
 */
function getPlayerStats($pdo, $player_id) {
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT s.id) as total_matches,
            SUM(CASE WHEN se.event_type = 'goal' THEN 1 ELSE 0 END) as total_goals,
            SUM(CASE WHEN se.event_type = 'assist' THEN 1 ELSE 0 END) as total_assists,
            SUM(CASE WHEN se.event_type = 'yellow_card' THEN 1 ELSE 0 END) as total_yellow_cards,
            SUM(CASE WHEN se.event_type = 'red_card' THEN 1 ELSE 0 END) as total_red_cards
        FROM sets s
        LEFT JOIN set_events se ON s.id = se.set_id AND se.player_id = ?
        WHERE JSON_CONTAINS(s.team_a_players, ?) OR JSON_CONTAINS(s.team_b_players, ?)
    ");
    $stmt->execute([$player_id, json_encode($player_id), json_encode($player_id)]);
    return $stmt->fetch();
}

/**
 * Calculate player rating based on performance
 */
function calculatePerformanceRating($goals, $assists, $yellow_cards, $red_cards, $matches_played) {
    $base_rating = 3.0;
    
    // Goals contribute positively
    $goal_score = min($goals * 0.3, 1.0);
    
    // Assists contribute positively
    $assist_score = min($assists * 0.2, 0.8);
    
    // Cards contribute negatively
    $card_penalty = min(($yellow_cards * 0.1) + ($red_cards * 0.3), 1.0);
    
    // Match participation bonus
    $participation_bonus = min($matches_played * 0.05, 0.5);
    
    $final_rating = $base_rating + $goal_score + $assist_score - $card_penalty + $participation_bonus;
    
    // Clamp between 1 and 5
    return max(1, min(5, round($final_rating, 1)));
}

/**
 * Generate player card (for printing)
 */
function generatePlayerCard($player) {
    $html = '
    <div class="player-card">
        <div class="player-photo">
            ' . ($player['profile_image'] ? '<img src="' . $player['profile_image'] . '" alt="' . htmlspecialchars($player['full_name']) . '">' : '<div class="no-photo">' . strtoupper(substr($player['full_name'], 0, 1)) . '</div>') . '
        </div>
        <div class="player-info">
            <h3>#' . $player['player_number'] . ' ' . htmlspecialchars($player['full_name']) . '</h3>
            <p class="position">' . $player['position'] . '</p>
            <div class="stats">
                <span>⚽ ' . $player['goals'] . '</span>
                <span>🎯 ' . $player['assists'] . '</span>
                <span>★ ' . $player['rating'] . '/5</span>
            </div>
        </div>
    </div>';
    
    return $html;
}

/**
 * Validate image upload
 */
function validateImageUpload($file) {
    $errors = [];
    $allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    $max_size = 5 * 1024 * 1024; // 5MB
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors[] = "File upload error: " . $file['error'];
        return $errors;
    }
    
    // Check file type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime_type = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mime_type, $allowed_types)) {
        $errors[] = "Invalid file type. Allowed: JPG, PNG, GIF, WebP";
    }
    
    // Check file size
    if ($file['size'] > $max_size) {
        $errors[] = "File too large. Maximum size: 5MB";
    }
    
    return $errors;
}

/**
 * Resize image for thumbnail
 */
function createThumbnail($source_path, $dest_path, $max_width = 200, $max_height = 200) {
    list($width, $height, $type) = getimagesize($source_path);
    
    // Calculate new dimensions
    $ratio = $width / $height;
    if ($max_width / $max_height > $ratio) {
        $new_width = $max_height * $ratio;
        $new_height = $max_height;
    } else {
        $new_width = $max_width;
        $new_height = $max_width / $ratio;
    }
    
    // Create new image
    $thumb = imagecreatetruecolor($new_width, $new_height);
    
    // Load source image based on type
    switch ($type) {
        case IMAGETYPE_JPEG:
            $source = imagecreatefromjpeg($source_path);
            break;
        case IMAGETYPE_PNG:
            $source = imagecreatefrompng($source_path);
            // Preserve transparency
            imagealphablending($thumb, false);
            imagesavealpha($thumb, true);
            break;
        case IMAGETYPE_GIF:
            $source = imagecreatefromgif($source_path);
            break;
        case IMAGETYPE_WEBP:
            $source = imagecreatefromwebp($source_path);
            break;
        default:
            return false;
    }
    
    // Resize image
    imagecopyresampled($thumb, $source, 0, 0, 0, 0, $new_width, $new_height, $width, $height);
    
    // Save thumbnail
    switch ($type) {
        case IMAGETYPE_JPEG:
            imagejpeg($thumb, $dest_path, 85);
            break;
        case IMAGETYPE_PNG:
            imagepng($thumb, $dest_path);
            break;
        case IMAGETYPE_GIF:
            imagegif($thumb, $dest_path);
            break;
        case IMAGETYPE_WEBP:
            imagewebp($thumb, $dest_path, 85);
            break;
    }
    
    // Free memory
    imagedestroy($source);
    imagedestroy($thumb);
    
    return true;
}
?>