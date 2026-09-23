<?php
// includes/auth.php
session_start();

function requireLogin() {
    if (!isset($_SESSION['team_id']) || !isset($_SESSION['role'])) {
        header('Location: ../index.php');
        exit();
    }
}

function requireAdmin() {
    requireLogin();
    if ($_SESSION['role'] !== 'admin') {
        header('Location: ../player/dashboard.php');
        exit();
    }
}

function requirePlayer() {
    requireLogin();
    if ($_SESSION['role'] !== 'player') {
        header('Location: ../admin/dashboard.php');
        exit();
    }
}

// Get current team ID
function getTeamId() {
    return $_SESSION['team_id'] ?? null;
}

// Get current role
function getRole() {
    return $_SESSION['role'] ?? null;
}
?>