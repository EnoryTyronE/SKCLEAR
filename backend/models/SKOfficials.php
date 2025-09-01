<?php
require_once '../config/database.php';

class SKOfficials {
    private $conn;
    private $table_name = "sk_officials";

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function getAll() {
        $query = "SELECT * FROM " . $this->table_name . " ORDER BY 
                  CASE position 
                    WHEN 'SK Chairperson' THEN 1
                    WHEN 'SK Treasurer' THEN 2
                    WHEN 'SK Secretary' THEN 3
                    ELSE 4
                  END, name";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " 
                  (name, position, contact_number, email) 
                  VALUES (:name, :position, :contact_number, :email)";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(":name", $data['name']);
        $stmt->bindParam(":position", $data['position']);
        $stmt->bindParam(":contact_number", $data['contact']);
        $stmt->bindParam(":email", $data['email']);
        
        return $stmt->execute();
    }

    public function update($id, $data) {
        $query = "UPDATE " . $this->table_name . " SET 
                  name = :name,
                  position = :position,
                  contact_number = :contact_number,
                  email = :email,
                  updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":name", $data['name']);
        $stmt->bindParam(":position", $data['position']);
        $stmt->bindParam(":contact_number", $data['contact']);
        $stmt->bindParam(":email", $data['email']);
        
        return $stmt->execute();
    }

    public function delete($id) {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $id);
        return $stmt->execute();
    }

    public function deleteAll() {
        $query = "DELETE FROM " . $this->table_name;
        $stmt = $this->conn->prepare($query);
        return $stmt->execute();
    }

    public function saveOfficials($officials) {
        // First, delete all existing officials
        $this->deleteAll();
        
        // Then insert the new ones
        foreach ($officials as $official) {
            if (!empty($official['name']) && !empty($official['position'])) {
                $this->create($official);
            }
        }
        
        return true;
    }
}
?> 