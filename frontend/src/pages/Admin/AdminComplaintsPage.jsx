import React, { useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminSimplePage.css';
import './AdminHelpersPage.css';
import './AdminComplaintsPage.css';

const AdminComplaintsPage = () => {
  const [tab, setTab] = useState('violations');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [violationType, setViolationType] = useState('');
  const [actorId, setActorId] = useState('');
  const [postId, setPostId] = useState('');
  const [violations, setViolations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [editLogs, setEditLogs] = useState([]);
  const tabs = [
    { id: 'violations', label: 'Vi phạm', count: violations.length },
    { id: 'audit', label: 'Audit Logs', count: auditLogs.length },
    { id: 'edits', label: 'Lịch sử chỉnh sửa', count: editLogs.length },
  ];

  const renderLoading = () => <p className="complaints-status">Đang tải dữ liệu...</p>;
  const renderEmpty = (message) => <p className="complaints-status complaints-status--empty">{message}</p>;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [vRes, aRes, eRes] = await Promise.all([
          AdminService.getViolations(violationType ? { violationType, size: 20 } : { size: 20 }),
          AdminService.getAuditLogs(actorId ? { actorId: Number(actorId), size: 20 } : { size: 20 }),
          AdminService.getJobPostEditLogs(postId ? { postId: Number(postId), size: 20 } : { size: 20 }),
        ]);
        setViolations(vRes.violations || []);
        setAuditLogs(aRes.logs || []);
        setEditLogs(eRes.logs || []);
      } catch (err) {
        setToast({ type: 'error', message: err?.message || 'Không tải được dữ liệu vận hành admin' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [violationType, actorId, postId]);

  return (
    <AdminLayout>
      {toast && (
        <NotificationModal
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Khiếu nại &amp; Hoàn tiền</h1>
          <p className="admin-simple-desc">Trung tâm vận hành: vi phạm, audit logs và lịch sử chỉnh sửa tin đăng.</p>

          <div className="complaints-tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`complaints-tab ${tab === item.id ? 'complaints-tab--active' : ''}`}
              >
                <span>{item.label}</span>
                <span className="complaints-tab-count">{item.count}</span>
              </button>
            ))}
          </div>

          {tab === 'violations' && (
            <>
              <div className="complaints-filter-row">
                <label htmlFor="violationType">Loại vi phạm</label>
                <input
                  id="violationType"
                  className="complaints-input"
                  value={violationType}
                  onChange={(e) => setViolationType(e.target.value)}
                  placeholder="VD: HELPER_NO_SHOW"
                />
              </div>
              {loading ? renderLoading() : (
                violations.length ? (
                  <div className="helpers-table-wrapper">
                    <table className="helpers-table">
                      <thead>
                        <tr>
                          <th>ID</th><th>User</th><th>Role</th><th>Type</th><th>Severity</th><th>Penalty</th><th>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {violations.map((v) => (
                          <tr key={v.violationId}>
                            <td>{v.violationId}</td>
                            <td>{v.userName || v.userId}</td>
                            <td>{v.userRole || '—'}</td>
                            <td>{v.violationType}</td>
                            <td>{v.severity}</td>
                            <td>{v.penaltyAmount ?? '—'}</td>
                            <td>{v.createdAt ? new Date(v.createdAt).toLocaleString('vi-VN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : renderEmpty('Không có dữ liệu vi phạm theo bộ lọc hiện tại.')
              )}
            </>
          )}

          {tab === 'audit' && (
            <>
              <div className="complaints-filter-row">
                <label htmlFor="actorId">ID Admin thao tác</label>
                <input
                  id="actorId"
                  className="complaints-input"
                  value={actorId}
                  onChange={(e) => setActorId(e.target.value)}
                  placeholder="ID admin"
                />
              </div>
              {loading ? renderLoading() : (
                auditLogs.length ? (
                  <div className="helpers-table-wrapper">
                    <table className="helpers-table">
                      <thead>
                        <tr>
                          <th>ID</th><th>Event</th><th>Admin</th><th>Target</th><th>Kết quả</th><th>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((l) => (
                          <tr key={l.auditId}>
                            <td>{l.auditId}</td>
                            <td>{l.eventLabel || l.eventType}</td>
                            <td>{l.actorEmail}</td>
                            <td>{l.targetType}#{l.targetId ?? '—'}</td>
                            <td>{l.result}</td>
                            <td>{l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : renderEmpty('Không có audit logs theo bộ lọc hiện tại.')
              )}
            </>
          )}

          {tab === 'edits' && (
            <>
              <div className="complaints-filter-row">
                <label htmlFor="postId">ID tin đăng</label>
                <input
                  id="postId"
                  className="complaints-input"
                  value={postId}
                  onChange={(e) => setPostId(e.target.value)}
                  placeholder="ID tin đăng"
                />
              </div>
              {loading ? renderLoading() : (
                editLogs.length ? (
                  <div className="helpers-table-wrapper">
                    <table className="helpers-table">
                      <thead>
                        <tr>
                          <th>EditID</th><th>PostID</th><th>EditedBy</th><th>Revision</th><th>Old title</th><th>New title</th><th>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editLogs.map((l) => (
                          <tr key={l.editLogId}>
                            <td>{l.editLogId}</td>
                            <td>{l.postId}</td>
                            <td>{l.editedBy}</td>
                            <td>{l.revisionNo}</td>
                            <td>{l.oldTitle || '—'}</td>
                            <td>{l.newTitle || '—'}</td>
                            <td>{l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : renderEmpty('Không có lịch sử chỉnh sửa theo bộ lọc hiện tại.')
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminComplaintsPage;