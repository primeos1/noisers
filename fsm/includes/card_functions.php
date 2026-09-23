<?php
// includes/card_functions.php

function addCardFine($pdo, $player_id, $card_type) {
    try {
        // Get fine amount
        $stmt = $pdo->prepare("SELECT amount FROM card_fines WHERE card_type = ? AND is_active = 1");
        $stmt->execute([$card_type]);
        $fine_amount = $stmt->fetchColumn();
        
        if ($fine_amount) {
            // Update player's outstanding fees
            $stmt = $pdo->prepare("
                UPDATE players 
                SET outstanding_fees = outstanding_fees + ?
                WHERE id = ?
            ");
            $stmt->execute([$fine_amount, $player_id]);
            
            // Create pending payment record
            $stmt = $pdo->prepare("
                INSERT INTO card_payments 
                (player_id, card_type, amount, status)
                VALUES (?, ?, ?, 'pending')
            ");
            $stmt->execute([$player_id, $card_type, $fine_amount]);
            
            return true;
        }
    } catch (Exception $e) {
        error_log("Error adding card fine: " . $e->getMessage());
    }
    return false;
}

// Function to get player card summary
function getPlayerCardSummary($pdo, $player_id) {
    $stmt = $pdo->prepare("
        SELECT 
            yellow_cards,
            red_cards,
            outstanding_fees,
            total_paid,
            (SELECT COUNT(*) FROM card_payments WHERE player_id = ? AND card_type = 'yellow' AND status = 'paid') as yellow_paid,
            (SELECT COUNT(*) FROM card_payments WHERE player_id = ? AND card_type = 'red' AND status = 'paid') as red_paid
        FROM players 
        WHERE id = ?
    ");
    $stmt->execute([$player_id, $player_id, $player_id]);
    return $stmt->fetch();
}