<?php
require_once '../config/database.php';

class CBYDPProjects {
    private $conn;
    private $table_name = "cbydp_projects";

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " 
                  (center_id, project_name, objectives, activities, target_beneficiaries, 
                   timeline, budget_requirement, funding_source, sort_order) 
                  VALUES (:center_id, :project_name, :objectives, :activities, :target_beneficiaries, 
                          :timeline, :budget_requirement, :funding_source, :sort_order)";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":center_id", $data['center_id']);
        $stmt->bindParam(":project_name", $data['project_name']);
        $stmt->bindParam(":objectives", $data['objectives']);
        $stmt->bindParam(":activities", $data['activities']);
        $stmt->bindParam(":target_beneficiaries", $data['target_beneficiaries']);
        $stmt->bindParam(":timeline", $data['timeline']);
        $stmt->bindParam(":budget_requirement", $data['budget_requirement']);
        $stmt->bindParam(":funding_source", $data['funding_source']);
        $stmt->bindParam(":sort_order", $data['sort_order']);
        
        if ($stmt->execute()) {
            return $this->conn->lastInsertId();
        }
        return false;
    }

    public function getByCenterId($center_id) {
        $query = "SELECT * FROM " . $this->table_name . " 
                  WHERE center_id = :center_id ORDER BY sort_order, id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":center_id", $center_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getByCBYDPId($cbydp_id) {
        $query = "SELECT p.*, c.center_name 
                  FROM " . $this->table_name . " p
                  JOIN cbydp_centers c ON p.center_id = c.id
                  WHERE c.cbydp_id = :cbydp_id 
                  ORDER BY c.sort_order, p.sort_order";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":cbydp_id", $cbydp_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function update($id, $data) {
        $query = "UPDATE " . $this->table_name . " SET 
                  project_name = :project_name,
                  objectives = :objectives,
                  activities = :activities,
                  target_beneficiaries = :target_beneficiaries,
                  timeline = :timeline,
                  budget_requirement = :budget_requirement,
                  funding_source = :funding_source,
                  sort_order = :sort_order
                  WHERE id = :id";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":project_name", $data['project_name']);
        $stmt->bindParam(":objectives", $data['objectives']);
        $stmt->bindParam(":activities", $data['activities']);
        $stmt->bindParam(":target_beneficiaries", $data['target_beneficiaries']);
        $stmt->bindParam(":timeline", $data['timeline']);
        $stmt->bindParam(":budget_requirement", $data['budget_requirement']);
        $stmt->bindParam(":funding_source", $data['funding_source']);
        $stmt->bindParam(":sort_order", $data['sort_order']);
        
        return $stmt->execute();
    }

    public function delete($id) {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $id);
        return $stmt->execute();
    }

    public function deleteByCenterId($center_id) {
        $query = "DELETE FROM " . $this->table_name . " WHERE center_id = :center_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":center_id", $center_id);
        return $stmt->execute();
    }

    public function saveProjects($center_id, $projects) {
        // First, delete existing projects for this center
        $this->deleteByCenterId($center_id);
        
        // Then insert the new projects
        foreach ($projects as $index => $project) {
            if (!empty($project['projectName']) && !empty($project['objectives'])) {
                $this->create([
                    'center_id' => $center_id,
                    'project_name' => $project['projectName'],
                    'objectives' => $project['objectives'],
                    'activities' => $project['activities'],
                    'target_beneficiaries' => $project['targetBeneficiaries'],
                    'timeline' => $project['timeline'],
                    'budget_requirement' => $project['budgetRequirement'],
                    'funding_source' => $project['fundingSource'],
                    'sort_order' => $index
                ]);
            }
        }
        
        return true;
    }
}
?> 