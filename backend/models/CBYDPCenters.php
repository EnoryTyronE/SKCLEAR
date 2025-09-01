<?php
require_once '../config/database.php';

class CBYDPCenters {
    private $conn;
    private $table_name = "cbydp_centers";

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " 
                  (cbydp_id, center_name, agenda_statement, sort_order) 
                  VALUES (:cbydp_id, :center_name, :agenda_statement, :sort_order)";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":cbydp_id", $data['cbydp_id']);
        $stmt->bindParam(":center_name", $data['center_name']);
        $stmt->bindParam(":agenda_statement", $data['agenda_statement']);
        $stmt->bindParam(":sort_order", $data['sort_order']);
        
        if ($stmt->execute()) {
            return $this->conn->lastInsertId();
        }
        return false;
    }

    public function getByCBYDPId($cbydp_id) {
        $query = "SELECT * FROM " . $this->table_name . " 
                  WHERE cbydp_id = :cbydp_id ORDER BY sort_order, id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":cbydp_id", $cbydp_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function update($id, $data) {
        $query = "UPDATE " . $this->table_name . " SET 
                  center_name = :center_name,
                  agenda_statement = :agenda_statement,
                  sort_order = :sort_order
                  WHERE id = :id";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":center_name", $data['center_name']);
        $stmt->bindParam(":agenda_statement", $data['agenda_statement']);
        $stmt->bindParam(":sort_order", $data['sort_order']);
        
        return $stmt->execute();
    }

    public function delete($id) {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $id);
        return $stmt->execute();
    }

    public function deleteByCBYDPId($cbydp_id) {
        $query = "DELETE FROM " . $this->table_name . " WHERE cbydp_id = :cbydp_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":cbydp_id", $cbydp_id);
        return $stmt->execute();
    }

    public function saveCenters($cbydp_id, $centers) {
        // First, delete existing centers for this CBYDP
        $this->deleteByCBYDPId($cbydp_id);
        
        // Then insert the new centers
        foreach ($centers as $index => $center) {
            if (!empty($center['centerName']) && !empty($center['agendaStatement'])) {
                $this->create([
                    'cbydp_id' => $cbydp_id,
                    'center_name' => $center['centerName'],
                    'agenda_statement' => $center['agendaStatement'],
                    'sort_order' => $index
                ]);
            }
        }
        
        return true;
    }
}
?> 