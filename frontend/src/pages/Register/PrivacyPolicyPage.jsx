import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPolicyPage.css';

const PrivacyPolicyPage = () => {
    return (
        <div className="terms-container">
            <div className="terms-card">
                <div className="terms-header">
                    <h1 className="terms-title">Cam Kết Bảo Vệ Dữ Liệu Cá Nhân</h1>
                    <p className="terms-subtitle">HomieConnect Cung Cấp Dịch Vụ Theo Quy Định Về Bảo Vệ Dữ Liệu Cá Nhân (Nghị Định 13/2023/NĐ-CP)</p>
                </div>

                <div className="terms-content">
                    <section className="terms-section">
                        <p>
                            Cam kết về bảo vệ dữ liệu cá nhân được thực hiện bởi và giữa HomieConnect và các Đại lý/Khách hàng/Đối tác cung cấp của HomieConnect (sau đây gọi chung là Bên Cung cấp).
                        </p>
                        <p>
                            HomieConnect và Bên Cung cấp tự nguyện đồng ý tuân thủ các quy định về bảo vệ dữ liệu cá nhân với các điều khoản sau đây:
                        </p>

                        <h3>Điều 1: Định nghĩa</h3>
                        <p>
                            <strong>“Hợp đồng”</strong> có nghĩa là Hợp đồng giữa Bên cung cấp và HomieConnect và/hoặc các biên bản, thỏa thuận, phụ lục liên quan tới các Hợp đồng đó. Đó có thể là hợp đồng mua bán hàng hóa, cung cấp dịch vụ, hợp đồng lao động, hợp đồng khác, vv.
                        </p>
                        <p>
                            <strong>“Dữ liệu cá nhân”</strong> có nghĩa là Dữ liệu cá nhân của bất kỳ chủ thể dữ liệu nào mà HomieConnect có được từ Bên cung cấp, nó có thể là dữ liệu cá nhân của chính Bên cung cấp, hoặc dữ liệu cá nhân của các chủ thể khác mà Bên cung cấp đã thu thập một cách hợp pháp và được phép chuyển giao, cung cấp cho HomieConnect để HomieConnect thực hiện các công việc được nêu trong (các) Hợp đồng giữa HomieConnect và Bên cung cấp.
                        </p>
                        <p>
                            <strong>“Luật bảo vệ dữ liệu”</strong> có nghĩa là tất cả các luật và quy định về bảo vệ dữ liệu cá nhân hoặc quyền riêng tư áp dụng cho hoạt động xử lý dữ liệu cá nhân tại Việt Nam, trong đó bao gồm nhưng không giới hạn ở Luật An ninh quốc gia 2004, Luật An ninh mạng 2018; Nghị định Số 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân cùng các bản sửa đổi, bổ sung, thay thế các văn bản trên.
                        </p>
                        <p>
                            <strong>“Hệ thống HomieConnect”</strong> có nghĩa là các trung tâm dữ liệu, hệ thống điện toán đám mây, máy chủ, thiết bị nối mạng, hệ thống phần mềm lưu trữ và các hệ thống khác (nếu có) của HomieConnect và được sử dụng để thực hiện phạm vi công việc theo (các) Hợp đồng đã ký kết giữa HomieConnect và Bên cung cấp.
                        </p>
                        <p>
                            Các thuật ngữ <strong>“dữ liệu cá nhân”</strong>, <strong>“chủ thể dữ liệu”</strong>, <strong>“xử lý dữ liệu cá nhân”</strong>, <strong>“bên kiểm soát”</strong> và <strong>“bên kiểm soát và xử lý”</strong> được sử dụng trong Cam kết này có các ý nghĩa như được quy định tại Nghị định Số 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
                        </p>

                        <h3>Điều 2: Nội dung bảo vệ dữ liệu cá nhân</h3>
                        <p>Các bên thừa nhận và đồng ý như sau:</p>
                        <ul>
                            <li>(i) HomieConnect là bên xử lý Dữ liệu cá nhân theo Luật bảo vệ dữ liệu;</li>
                            <li>(ii) Bên cung cấp là chủ thể dữ liệu hoặc bên kiểm soát hoặc bên kiểm soát và xử lý, đối với Dữ liệu cá nhân theo Luật bảo vệ dữ liệu;</li>
                            <li>(iii) mỗi bên sẽ tuân thủ các nghĩa vụ của mình theo Luật bảo vệ dữ liệu hiện hành liên quan đến việc xử lý Dữ liệu cá nhân.</li>
                        </ul>

                        <h4>Mục đích của việc thu thập, xử lý dữ liệu:</h4>
                        <p>
                            HomieConnect sẽ thu thập, lưu trữ, xử lý Dữ liệu cá nhân khi cần thiết để: thực hiện Hợp đồng ký kết với Bên cung cấp và các công việc có liên quan đến Hợp đồng.
                        </p>
                        <p>
                            Bên cung cấp đồng ý cho phép HomieConnect xử lý dữ liệu của Bên cung cấp và chia sẻ kết quả xử lý dữ liệu cho các mục đích sau:
                        </p>
                        <ul>
                            <li>Gửi các thông báo về các hoạt động trao đổi thông tin giữa Bên cung cấp và HomieConnect;</li>
                            <li>Ngăn ngừa các hoạt động phá hủy, chiếm đoạt tài khoản người dùng của Bên cung cấp hoặc các hoạt động giả mạo Bên cung cấp;</li>
                            <li>Tổ chức giới thiệu và xúc tiến thương mại, nghiên cứu thị trường, thăm dò dư luận, môi giới;</li>
                            <li>Nghiên cứu, phát triển các dịch vụ mới và cung cấp các sản phẩm, dịch vụ phù hợp cho Bên cung cấp;</li>
                            <li>HomieConnect có thể sử dụng thông tin của Bên cung cấp cho mục đích dịch vụ tiếp thị, giới thiệu sản phẩm quảng cáo;</li>
                            <li>Xác minh danh tính và đảm bảo tính bảo mật thông tin của Bên cung cấp;</li>
                            <li>HomieConnect thu thập, lưu trữ và sử dụng dữ liệu cá nhân của Bên cung cấp nhằm mục đích thực hiện dịch vụ như lưu giữ hồ sơ và tuân thủ các nghĩa vụ pháp lý và thuế. HomieConnect lưu trữ các dữ liệu này trong thời gian theo quy định của pháp luật;</li>
                            <li>HomieConnect thực hiện các hành động khác theo quy định của pháp luật từng thời kỳ.</li>
                        </ul>

                        <p>
                            HomieConnect sẽ không: (a) xử lý, lưu giữ, sử dụng, hay tiết lộ Dữ liệu cá nhân trừ khi cần thiết để thực hiện các nghĩa vụ của Hợp đồng, hay theo pháp luật yêu cầu; (b) bán Dữ liệu cá nhân cho bất kỳ bên thứ ba nào; (c) lưu giữ, sử dụng hay tiết lộ Dữ liệu cá nhân đó ra bên ngoài mối quan hệ kinh doanh trực tiếp giữa HomieConnect với Bên cung cấp, trừ khi đó là tuân theo yêu cầu của chủ thể dữ liệu hoặc quy định của pháp luật.
                        </p>
                        <p>
                            Để làm rõ, các hướng dẫn của Bên cung cấp về việc xử lý Dữ liệu cá nhân sẽ phù hợp với nội dung Hợp đồng và tuân theo tất cả các Luật về bảo vệ dữ liệu. Bên cung cấp chịu trách nhiệm về sự chính xác, chất lượng và tính hợp pháp của Dữ liệu cá nhân và phương thức mà Bên cung cấp nhận được Dữ liệu cá nhân. Nếu Bên cung cấp không phải là chủ thể dữ liệu cá nhân, Bên cung cấp thừa nhận và đồng ý như sau: (i) Bên cung cấp đã nhận được sự đồng ý rõ ràng (theo quy định Luật bảo vệ dữ liệu) của chủ thể dữ liệu đối với mọi hoạt động thu thập, chia sẻ và sử dụng dữ liệu như các nội dung đã thỏa thuận theo Hợp đồng; và (ii) Bên cung cấp đã thông báo và nhận được sự đồng ý rõ ràng (theo quy định Luật bảo vệ dữ liệu) của chủ thể dữ liệu về việc Dữ liệu cá nhân có thể được xử lý bên ngoài quốc gia ban đầu của họ. Nếu Bên cung cấp là bên kiểm soát và xử lý Dữ liệu cá nhân, Bên cung cấp đảm bảo rằng các hướng dẫn và hành động của Bên cung cấp đối với Dữ liệu cá nhân, bao gồm cả việc chỉ định HomieConnect làm bên xử lý khác, đã được ủy quyền bởi bên kiểm soát có liên quan. HomieConnect sẽ không bắt buộc phải tuân thủ hoặc tuân theo hướng dẫn của Bên cung cấp nếu những hướng dẫn đó vi phạm Luật bảo vệ dữ liệu.
                        </p>

                        <h4>Các loại Dữ liệu cá nhân được bảo vệ:</h4>
                        <p>
                            Dữ liệu cá nhân được bảo vệ theo Cam kết này là thông tin dưới dạng ký hiệu, chữ viết, chữ số, hình ảnh, âm thanh hoặc dạng tương tự trên môi trường điện tử gắn liền với một con người cụ thể hoặc giúp xác định một con người cụ thể, có thể là các dữ liệu cá nhân cơ bản và dữ liệu cá nhân nhạy cảm bao gồm: tên; địa chỉ, số điện thoại; ngày sinh, địa chỉ email, thông tin về nghề nghiệp, tình trạng sức khỏe, thu nhập hoặc bất kỳ thông tin nào mà theo quy định pháp luật tại từng thời điểm được định nghĩa là dữ liệu cá nhân.
                        </p>
                        <p>
                            HomieConnect sẽ thu thập, phân tích, đánh giá, sử dụng, lưu trữ, chuyển giao, xử lý, cung cấp Dữ liệu cá nhân cho các bên có liên quan hoặc cơ quan nhà nước có thẩm quyền và các hoạt động khác phục vụ cho mục đích đã nêu tại khoản 2 Điều này.
                        </p>

                        <h4>Các bên liên quan đến việc bảo vệ Dữ liệu cá nhân:</h4>
                        <p>
                            Bên cung cấp đồng ý rằng, để phục vụ cho các mục đích đã nêu tại khoản 2 Điều này, HomieConnect có thể tiết lộ Dữ liệu cá nhân cho công ty con và/hoặc liên kết ở mức độ cần thiết để áp dụng và thực hiện các mục đích hoặc bất kỳ phần nào, tùy thuộc vào các công ty con và/hoặc liên kết cam kết thực hiện đúng các nghĩa vụ tương đương theo quy định tại Cam kết này.
                        </p>

                        <h4>Thời gian bảo vệ dữ liệu cá nhân:</h4>
                        <p>
                            Việc bảo vệ Dữ liệu cá nhân sẽ được bắt đầu kể từ thời điểm HomieConnect nhận được thông tin/dữ liệu cá nhân cũng như sự đồng ý của Bên cung cấp cho việc xử lý thông tin/dữ liệu cá nhân đó.
                        </p>
                    </section>
                </div>

                <div className="terms-footer">
                    <Link to="/register" className="back-button">Đã hiểu và quay lại</Link>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
