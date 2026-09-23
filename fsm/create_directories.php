<?php
// create_directories.php
$team_id = 1; // Your team ID

$directories = [
    "../assets/uploads/teams/$team_id/players",
    "../assets/uploads/teams/$team_id/matches",
    "../assets/uploads/teams/$team_id/temp"
];

foreach ($directories as $dir) {
    if (!file_exists($dir)) {
        mkdir($dir, 0777, true);
        echo "Created directory: $dir<br>";
    } else {
        echo "Directory exists: $dir<br>";
    }
}

// Create .htaccess to protect uploads
$htaccess = "../assets/uploads/.htaccess";
$htaccess_content = "Order Deny,Allow\nDeny from all\n\n<FilesMatch \"\.(jpg|jpeg|png|gif|webp)$\">\nOrder Allow,Deny\nAllow from all\n</FilesMatch>";
file_put_contents($htaccess, $htaccess_content);
echo "Created .htaccess file<br>";
?>