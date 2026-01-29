import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("agents");
  const [agents, setAgents] = useState([]);
  const [distributedLists, setDistributedLists] = useState([]);
  const [callList, setCallList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [editingAgent, setEditingAgent] = useState(null);

  const [agentForm, setAgentForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [callListFile, setCallListFile] = useState(null);
  const mobileRegex = /^\+91\d{10}$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

  const loadAgents = useCallback(async () => {
    try {
      const response = await api.get("/agents");
      setAgents(response.data);
    } catch (error) {
      showMessage("error", "Failed to load agents");
    }
  }, []);

  const loadDistributedLists = useCallback(async () => {
    try {
      const response = await api.get("/lists/distributed");
      setDistributedLists(response.data.distributedLists || []);
    } catch (error) {
      showMessage("error", "Failed to load lists");
    }
  }, []);

  const loadCallList = useCallback(async () => {
    try {
      const response = await api.get("/call-list");
      setCallList(response.data.callList || []);
    } catch (error) {
      showMessage("error", "Failed to load call list");
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    loadAgents();
    loadDistributedLists();
    loadCallList();
  }, [navigate, loadAgents, loadDistributedLists, loadCallList]);

  const handleCallRecord = async (record) => {
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await api.patch(`/call-list/${record.id}/complete`);
      showMessage("success", "Call marked as completed");
      await loadCallList();

      if (record.mobile) {
        window.location.href = `tel:${record.mobile}`;
      }
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message || "Failed to update call status",
      );
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleAgentFormChange = (e) => {
    setAgentForm({
      ...agentForm,
      [e.target.name]: e.target.value,
    });
  };

  const resetForm = () => {
    setAgentForm({ name: "", email: "", mobile: "", password: "" });
    setEditingAgent(null);
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    const mobileValue = String(agentForm.mobile || "").trim();
    if (!mobileRegex.test(mobileValue)) {
      showMessage("error", "Mobile must be in format +91 followed by 10 digits");
      return;
    }
    const passwordValue = String(agentForm.password || "");
    if (!passwordRegex.test(passwordValue)) {
      showMessage(
        "error",
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      );
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await api.post("/agents", { ...agentForm, mobile: mobileValue });
      showMessage("success", "Agent created successfully");
      resetForm();
      loadAgents();
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Failed to create agent");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (agent) => {
    setEditingAgent(agent._id);
    setAgentForm({
      name: agent.name,
      email: agent.email,
      mobile: agent.mobile,
      password: "",
    });
  };

  const handleUpdateAgent = async (e) => {
    e.preventDefault();
    
    if (!editingAgent) {
      showMessage("error", "No agent selected for editing");
      return;
    }

    const mobileValue = String(agentForm.mobile || "").trim();
    if (!mobileRegex.test(mobileValue)) {
      showMessage("error", "Mobile must be in format +91 followed by 10 digits");
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const updateData = {
        name: agentForm.name,
        email: agentForm.email,
        mobile: mobileValue,
      };

      if (agentForm.password && agentForm.password.trim() !== "") {
        if (!passwordRegex.test(String(agentForm.password))) {
          showMessage(
            "error",
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
          );
          setLoading(false);
          return;
        }
        updateData.password = agentForm.password;
      }

      await api.put(`/agents/${editingAgent}`, updateData);
      showMessage("success", "Agent updated successfully");
      resetForm();
      loadAgents();
    } catch (error) {
      if (error.response?.status === 404) {
        showMessage("error", "Agent not found. Please refresh the page.");
      } else {
        const errorMessage = error.response?.data?.message || error.message || "Failed to update agent";
        showMessage("error", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this agent?")) {
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await api.delete(`/agents/${id}`);
      showMessage("success", "Agent deleted successfully");
      loadAgents();
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Failed to delete agent");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["csv", "xlsx", "xls"].includes(ext)) {
        setSelectedFile(file);
        setMessage({ type: "", text: "" });
      } else {
        showMessage("error", "Only CSV, XLSX, and XLS files are allowed");
        e.target.value = "";
      }
    }
  };

  const handleCallListFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "csv") {
        setCallListFile(file);
        setMessage({ type: "", text: "" });
      } else {
        showMessage("error", "Only CSV files are allowed for Call List upload");
        e.target.value = "";
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showMessage("error", "Please select a file");
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.post("/lists/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      showMessage("success", "File uploaded and distributed successfully");
      setSelectedFile(null);
      e.target.reset();
      loadDistributedLists();
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const handleCallListUpload = async (e) => {
    e.preventDefault();
    if (!callListFile) {
      showMessage("error", "Please select a CSV file for Call List");
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("file", callListFile);

      await api.post("/call-list", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      showMessage("success", "Call list CSV uploaded and distributed successfully");
      setCallListFile(null);
      await loadCallList();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message || error.message || "Failed to upload Call List CSV",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearCallList = async () => {
    if (!window.confirm("Are you sure you want to remove all call records?")) {
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await api.delete("/call-list");
      showMessage("success", "All call records have been removed");
      await loadCallList();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message || error.message || "Failed to remove call records",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeCallList = async () => {
    // No longer used (distribution happens automatically on upload)
    return;
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </header>

      <div className="container">
        {message.text && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "agents" ? "active" : ""}`}
            onClick={() => setActiveTab("agents")}
          >
            Agents
          </button>
          <button
            className={`tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload CSV
          </button>
          <button
            className={`tab ${activeTab === "lists" ? "active" : ""}`}
            onClick={() => setActiveTab("lists")}
          >
            Distributed Lists
          </button>
          <button
            className={`tab ${activeTab === "callList" ? "active" : ""}`}
            onClick={() => setActiveTab("callList")}
          >
            Call List
          </button>
        </div>
        {activeTab === "agents" && (
          <div>
            <div className="card">
              <h3>{editingAgent ? "Edit Agent" : "Add New Agent"}</h3>
              <form onSubmit={editingAgent ? handleUpdateAgent : handleCreateAgent}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      name="name"
                      value={agentForm.name}
                      onChange={handleAgentFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={agentForm.email}
                      onChange={handleAgentFormChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input
                      type="text"
                      name="mobile"
                      value={agentForm.mobile}
                      onChange={handleAgentFormChange}
                      placeholder="+919876543210"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password {editingAgent && "(leave empty to keep current)"}</label>
                    <input
                      type="password"
                      name="password"
                      value={agentForm.password}
                      onChange={handleAgentFormChange}
                      required={!editingAgent}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : editingAgent ? "Update Agent" : "Create Agent"}
                  </button>
                  {editingAgent && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetForm}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="card">
              <h3>All Agents ({agents.length})</h3>
              {agents.length === 0 ? (
                <p>No agents created yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent._id}>
                        <td>{agent.name}</td>
                        <td>{agent.email}</td>
                        <td>{agent.mobile}</td>
                        <td>
                          <button
                            onClick={() => handleEditClick(agent)}
                            className="btn btn-small"
                            style={{ marginRight: "5px" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent._id)}
                            className="btn btn-small btn-danger"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeTab === "upload" && (
          <div className="card">
            <h3>Upload CSV/XLSX File</h3>
            <p className="info-text">
              Upload a CSV or Excel file with columns: FirstName, Phone, Notes
            </p>
            <form onSubmit={handleFileUpload}>
              <div className="form-group">
                <label>Select File (CSV, XLSX, or XLS)</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  required
                />
              </div>
              {selectedFile && (
                <p className="success">Selected: {selectedFile.name}</p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !selectedFile}
              >
                {loading ? "Uploading..." : "Upload and Distribute"}
              </button>
            </form>
          </div>
        )}

        {activeTab === "lists" && (
          <div>
            {distributedLists.length === 0 ? (
              <div className="card">
                <p>
                  No distributed lists yet. Upload a CSV file to distribute
                  items among agents.
                </p>
              </div>
            ) : (
              distributedLists.map((group, index) => (
                <div key={index} className="card">
                  <h3>
                    Agent: {group.agent.name} ({group.items.length} items)
                  </h3>
                  <p>
                    <strong>Email:</strong> {group.agent.email}
                  </p>
                  <p>
                    <strong>Mobile:</strong> {group.agent.mobile}{" "}
                    <a
                      href={`tel:${group.agent.mobile}`}
                      className="btn btn-small"
                      style={{ marginLeft: "8px" }}
                    >
                      Call
                    </a>
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>First Name</th>
                        <th>Phone</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.firstName}</td>
                          <td>{item.phone}</td>
                          <td>{item.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === "callList" && (
          <div>
            <div className="card" style={{ marginBottom: "20px" }}>
              <h3>Upload Call List CSV</h3>
              <p className="info-text">
                Upload a CSV file with columns like: Record no, Name, Mobile no, Email.
              </p>
              <form onSubmit={handleCallListUpload}>
                <div className="form-group">
                  <label>Select Call List CSV</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCallListFileChange}
                    required
                  />
                </div>
                {callListFile && (
                  <p className="success">Selected: {callListFile.name}</p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !callListFile}
                >
                  {loading ? "Uploading..." : "Upload Call List"}
                </button>
              </form>
            </div>

            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <h3 style={{ margin: 0 }}>Call List ({callList.length})</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={handleClearCallList}
                    disabled={loading || callList.length === 0}
                  >
                    Remove All
                  </button>
                </div>
              </div>
              {callList.length === 0 ? (
                <p>No call records available.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Record No</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Email</th>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callList.map((record) => (
                      <tr key={record.id}>
                        <td>{record.recordNo}</td>
                        <td>{record.name}</td>
                        <td>{record.mobile}</td>
                        <td>{record.email}</td>
                        <td>{record.agent?.name || "-"}</td>
                        <td>
                          {record.status === "completed" ? "Completed" : "Pending"}
                        </td>
                        <td>
                          <button
                            className="btn btn-small"
                            style={{
                              backgroundColor:
                                record.status === "completed" ? "#6c757d" : "#28a745",
                              borderColor:
                                record.status === "completed" ? "#6c757d" : "#28a745",
                              color: "#ffffff",
                            }}
                            disabled={loading || record.status === "completed"}
                            onClick={() => handleCallRecord(record)}
                          >
                            {record.status === "completed" ? "Done" : "Call"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
