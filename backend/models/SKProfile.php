<?php
require_once '../config/database.php';

class SKProfile {
    private $conn;
    private $table_name = "sk_profile";

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function getProfile() {
        $query = "SELECT * FROM " . $this->table_name . " ORDER BY id DESC LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " 
                  (barangay_name, municipality, province, region, barangay_logo, 
                   sk_term_start, sk_term_end, sk_federation_president) 
                  VALUES (:barangay_name, :municipality, :province, :region, :barangay_logo, 
                          :sk_term_start, :sk_term_end, :sk_federation_president)";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(":barangay_name", $data['barangayName']);
        $stmt->bindParam(":municipality", $data['municipality']);
        $stmt->bindParam(":province", $data['province']);
        $stmt->bindParam(":region", $data['region']);
        $stmt->bindParam(":barangay_logo", $data['barangayLogo']);
        $stmt->bindParam(":sk_term_start", $data['skTermStart']);
        $stmt->bindParam(":sk_term_end", $data['skTermEnd']);
        $stmt->bindParam(":sk_federation_president", $data['skFederationPresident']);
        
        return $stmt->execute();
    }

    public function update($data) {
        $query = "UPDATE " . $this->table_name . " SET 
                  barangay_name = :barangay_name,
                  municipality = :municipality,
                  province = :province,
                  region = :region,
                  barangay_logo = :barangay_logo,
                  sk_term_start = :sk_term_start,
                  sk_term_end = :sk_term_end,
                  sk_federation_president = :sk_federation_president,
                  updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(":id", $data['id']);
        $stmt->bindParam(":barangay_name", $data['barangayName']);
        $stmt->bindParam(":municipality", $data['municipality']);
        $stmt->bindParam(":province", $data['province']);
        $stmt->bindParam(":region", $data['region']);
        $stmt->bindParam(":barangay_logo", $data['barangayLogo']);
        $stmt->bindParam(":sk_term_start", $data['skTermStart']);
        $stmt->bindParam(":sk_term_end", $data['skTermEnd']);
        $stmt->bindParam(":sk_federation_president", $data['skFederationPresident']);
        
        return $stmt->execute();
    }

    public function saveOrUpdate($data) {
        $existing = $this->getProfile();
        
        if ($existing) {
            $data['id'] = $existing['id'];
            return $this->update($data);
        } else {
            return $this->create($data);
        }
    }
}
?> 