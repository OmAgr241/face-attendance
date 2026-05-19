import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';
import { User, Camera, UploadCloud, CheckCircle2 } from 'lucide-react';

export default function RegisterStudent() {
  const [form, setForm] = useState({
    name: '', roll_number: '', branch: '', semester: '', section: '', email: '', phone: ''
  });
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFiles = (e) => {
    const newFiles = Array.from(e.target.files);
    const totalFiles = [...files, ...newFiles].slice(0, 10);
    setFiles(totalFiles);
    setPreviews(totalFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.roll_number) return toast.error('Name and Roll Number required');
    if (files.length < 3) return toast.error('Upload at least 3 face images');
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      files.forEach((f) => formData.append('face_images', f));
      const res = await client.post('/students', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const fr = res.data.face_results || [];
      const errs = fr.filter((r) => r.error);
      const ok = fr.filter((r) => r.success);
      if (errs.length > 0 && ok.length === 0) toast.error('No faces detected');
      else if (errs.length > 0) toast.success(`Registered! ${ok.length} faces saved, ${errs.length} failed`);
      else toast.success('Student registered!');
      navigate(`/students/${res.data.student.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>INITIALIZE PROFILE</h1>
        <p>Bind new identity to face recognition dataset</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card" style={{ maxWidth: 800 }}>
        {/* Student Info Section */}
        <div className="section-header">
          <User size={20} color="var(--primary)" />
          <h3>IDENTITY METADATA</h3>
        </div>

        <div className="form-grid">
          <div className="form-group"><label>FULL NAME *</label><input name="name" className="form-input" placeholder="Subject Name" value={form.name} onChange={handleChange} required /></div>
          <div className="form-group"><label>ID NUMBER *</label><input name="roll_number" className="form-input" placeholder="SYS-2024-001" value={form.roll_number} onChange={handleChange} required /></div>
          <div className="form-group"><label>BRANCH</label><input name="branch" className="form-input" placeholder="Computer Science" value={form.branch} onChange={handleChange} /></div>
          <div className="form-group"><label>SEMESTER</label><input name="semester" className="form-input" placeholder="4" value={form.semester} onChange={handleChange} /></div>
          <div className="form-group"><label>SECTION</label><input name="section" className="form-input" placeholder="A" value={form.section} onChange={handleChange} /></div>
          <div className="form-group"><label>EMAIL CONTACT</label><input name="email" type="email" className="form-input" placeholder="comms@domain.com" value={form.email} onChange={handleChange} /></div>
          <div className="form-group"><label>PHONE CONTACT</label><input name="phone" className="form-input" placeholder="Phone identifier" value={form.phone} onChange={handleChange} /></div>
        </div>

        {/* Face Images Section */}
        <div className="mt-xl" style={{ borderTop: '1px dashed var(--border)', paddingTop: 'var(--space-xl)' }}>
          <div className="section-header">
            <Camera size={20} color="var(--primary)" />
            <h3>BIOMETRIC DATASET</h3>
          </div>
          <p className="text-sm mb-lg">Upload 3-10 clear face scans (JPG/PNG, max 5MB/file)</p>

          <div className="upload-area" onClick={() => fileRef.current?.click()}>
            <UploadCloud size={32} color="var(--border-hover)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>SELECT DATASET</p>
            <p className="text-sm" style={{ marginTop: '0.25rem' }}>or drag and drop files here</p>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png" onChange={handleFiles} style={{ display: 'none' }} />
          {previews.length > 0 && (
            <div className="image-previews">
              {previews.map((p, i) => (
                <div key={i} className="image-preview">
                  <img src={p.url} alt={p.name} />
                  <button type="button" className="remove-btn" onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm mt-md">
            <span className={`badge ${files.length >= 3 ? 'badge-success' : 'badge-warning'}`}>{files.length}/10</span> ASSETS LOADED
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-md" style={{ marginTop: 'var(--space-xl)' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--primary)' }}></div> PROCESSING...</> : (
              <>
                <CheckCircle2 size={18} />
                COMMIT PROFILE
              </>
            )}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/students')}>ABORT</button>
        </div>
      </form>
    </div>
  );
}
