import React from 'react';
import { Link } from 'react-router-dom';
import './TermsofServicePage.css';

const TermsofServicePage = () => {
    return (
        <div className="terms-container">
            <div className="terms-card">
                <div className="terms-header">
                    <h1 className="terms-title">Điều khoản sử dụng dịch vụ</h1>
                    <p className="terms-subtitle">Các điều khoản và điều kiện sử dụng dịch vụ của HomieConnect</p>
                </div>

                <div className="terms-content">
                    <section className="terms-section">
                        <p>
                            Các Điều khoản dưới đây (“Điều khoản”) điều chỉnh việc Khách hàng, một cá nhân hoặc tổ chức, truy cập hoặc sử dụng các ứng dụng, trang web, nội dung, sản phẩm và dịch vụ (“Dịch vụ”) của CÔNG TY CỔ PHẦN PHÁT TRIỂN DỊCH VỤ HOMIECONNECT, một doanh nghiệp thành lập theo pháp luật Việt Nam (“Công ty”).
                        </p>
                        <p>
                            <strong>VUI LÒNG ĐỌC KỸ CÁC ĐIỀU KHOẢN NÀY TRƯỚC KHI TRUY CẬP HOẶC SỬ DỤNG DỊCH VỤ.</strong>
                        </p>

                        <h3>Điều 1: Nội dung dịch vụ được cung cấp thông qua nền tảng kết nối:</h3>

                        <h4>1.1. Nền tảng công nghệ:</h4>
                        <p>
                            Công ty cung cấp một nền tảng công nghệ cho phép người dùng sử dụng các ứng dụng di động của Công ty hoặc các trang web được Công ty cung cấp như một phần của Dịch vụ (gọi chung là “Ứng dụng”) để kết nối Khách hàng có nhu cầu với một nhà cung cấp cá nhân sẵn sàng cung cấp dịch vụ giúp việc gia đình theo thỏa thuận với Công ty hoặc một số chi nhánh của Công ty (sau đây gọi tắt là “đối tác giúp việc”). Khách hàng công nhận rằng Khách hàng sử dụng Ứng dụng để tìm kiếm và kết nối với mỗi đối tác giúp việc để thực hiện công việc từng lần hoặc từng buổi, và với mỗi lần kết nối Khách hàng có quyền lựa chọn các đối tác giúp việc khác nhau tại các thời điểm khác nhau tuỳ theo nhu cầu và quyết định riêng để thực hiện dịch vụ giúp việc. Do đó, việc cung cấp dịch vụ giúp việc không phải là việc làm thường xuyên các công việc gia đình theo quy định tại Khoản 1 Điều 179 Bộ luật Lao động và Khoản 3 Điều 3 Nghị định 27/2014/NĐ-CP do Chính phủ ban hành ngày 07 tháng 4 năm 2014 hướng dẫn Bộ luật Lao động về lao động là người giúp việc gia đình. Công ty là một doanh nghiệp cung cấp dịch vụ công nghệ và không cung cấp dịch vụ việc làm, không có chức năng của doanh nghiệp hoạt động dịch vụ việc làm.
                        </p>
                        <p><strong>Công việc:</strong></p>
                        <ul>
                            <li>a. Dọn dẹp, vệ sinh toàn bộ diện tích nhà ở, bao gồm: phòng khách, phòng ngủ, bếp, nhà vệ sinh, ban công và các khu vực khác nằm trong diện tích khuôn viên nhà ở của Khách hàng;</li>
                            <li>b. Rửa cốc chén và các vật dụng;</li>
                            <li>c. Thu gom và vứt rác;</li>
                            <li>d. Lau chùi các thiết bị điện đơn giản;</li>
                            <li>e. Các công việc nội trợ khác theo yêu cầu của Khách hàng.</li>
                        </ul>

                        <h4>1.2. Dịch vụ khác:</h4>
                        <p>
                            Là các dịch vụ được hiển thị trên ứng dụng HomieConnect hoặc được tư vấn, truyền thông tới khách hàng bằng bất cứ công cụ truyền thông nào khác do Công ty cổ phần phát triển dịch vụ HomieConnect thực hiện.
                        </p>

                        <h3>Điều 2: Giá trị Hợp đồng và thanh toán:</h3>

                        <h4>2.1. Giá trị Hợp đồng:</h4>
                        <ul>
                            <li>a. Giá trị Hợp đồng sẽ căn cứ theo nhu cầu sử dụng dịch vụ thực tế của Khách hàng (thời gian, tần suất và thời hạn Hợp đồng của Khách hàng với Công ty).</li>
                            <li>b. Mức giá trong Hợp đồng áp dụng cho các công việc được nêu tại Điều 1 của Hợp đồng này.</li>
                            <li>c. Mức giá áp dụng vào các ngày Lễ, Tết được quy định như sau:
                                <ul>
                                    <li>Đối với 10 ngày trước và 10 ngày sau thời gian nghỉ Tết Nguyên Đán theo quy định của Nhà nước: mức giá sẽ áp dụng tương đương 130% so với mức giá ngày thường.</li>
                                    <li>Đối với thời gian nghỉ Tết Nguyên Đán: mức giá sẽ áp dụng tương đương 200% tại Hà Nội, Bắc Ninh, Quảng Ninh, Hải Phòng, Đã Nẵng, Nha Trang, Bình Dương và 250% tại Hồ Chí Minh so với mức giá ngày thường.</li>
                                    <li>Đối với các ngày nghỉ lễ khác theo qui định của nhà nước: mức giá sẽ áp dụng tương đương 200% so với mức giá ngày thường.</li>
                                </ul>
                            </li>
                        </ul>
                        <p>
                            Công ty không đảm bảo 100% việc có đối tác làm việc trong khoảng thời gian này. Trong trường hợp Khách hàng không có nhu cầu sử dụng dịch vụ trong thời điểm đối tác của Công ty tăng giá dịch vụ, Khách hàng cần báo trước cho Công ty tại thời điểm kí kết Hợp đồng và có kế hoạch dùng dịch vụ bù vào thời gian sau khoảng thời gian tăng giá dịch vụ.
                        </p>
                        <p>
                            d. Phí dịch vụ bổ sung là phí phụ thu các dịch vụ ngoài danh mục dọn dẹp như điều 1.1, cụ thể như sau: Nấu ăn, chăm bé, ủi đồ, vệ sinh thú cưng (chó, mèo, chim, sóc ),…Trong đó, mỗi dịch vụ bổ sung phí phụ thu 5% tổng giá trị hợp đồng.
                        </p>

                        <h4>2.2. Thanh toán:</h4>
                        <p>
                            a. Khách hàng thanh toán giá trị Hợp đồng trước khi sử dụng dịch vụ.
                        </p>
                        <p>
                            <strong>Hủy buổi làm việc:</strong> Hợp đồng này là Hợp đồng không hủy ngang. Trong trường hợp Khách hàng không sắp xếp được một hoặc một số buổi làm cho đối tác giúp việc thì buổi làm việc đó sẽ được làm bù. Buổi làm bù này sẽ được thực hiện trong thời gian tối đa là 01 (một) tháng tính từ ngày hết hạn Hợp đồng. Sau thời gian này, nếu Khách hàng không sắp xếp được thời gian để làm bù thì Công ty sẽ không có trách nhiệm kết nối đối tác cho Khách hàng nữa.
                        </p>
                        <p>
                            Trong trường hợp Khách hàng muốn thay đổi lịch làm việc, Khách hàng cần thông báo cho Công ty trước 12 tiếng của ca làm, nếu Khách hàng không thông báo trước thời gian 12 tiếng. Khách hàng sẽ bị tính phí kết nối 20,000đ.
                        </p>
                        <p>
                            <strong>Cơ sở tính phí dịch vụ:</strong> Là khoảng thời gian đối tác giúp việc làm việc tại địa điểm làm việc của Khách hàng, khoàng thời gian này được ghi nhận và thông báo trên ứng dụng HomieConnect dành cho Khách hàng. Để theo dõi được thông tin này Khách hàng cần cài ứng dụng HomieConnect.
                        </p>
                        <p>
                            Trong trường hợp giờ làm việc trong ngày phát sinh ngoài khung giờ đã thỏa thuận, Khách hàng cần thông báo trước để Công ty. Nếu Khách hàng không thông báo trước về giờ làm việc có thể phát sinh, Công ty sẽ không đảm bảo việc bố trí đối tác làm việc theo đúng yêu cầu của Khách hàng.
                        </p>
                        <p>
                            b. Các khoảng thời gian sau cũng được tính là thời gian làm việc của đối tác giúp việc cho Khách hàng:
                        </p>
                        <p>
                            Đối tác giúp việc đã đến địa điểm làm việc theo quy định tại Hợp đồng này nhưng Khách hàng đã không có mặt để mở cửa cho đối tác giúp việc thực hiện công việc trong khoảng thời gian 30 phút dẫn đến đối tác giúp việc không thể thực hiện công việc. Trong trường hợp này, thời gian làm việc của đối tác giúp việc được tính bằng 100% thời gian của buổi làm việc đó.
                        </p>
                        <p>
                            c. Hình thức thanh toán:
                        </p>
                        <ul>
                            <li>Chuyển khoản vào tài khoản thu hộ DUY NHẤT:
                                <br />Tài khoản số: 0611 001 925 656
                                <br />Tên tài khoản: Công ty Cổ phần Phát triển Dịch vụ HomieConnect
                                <br />Tại Ngân Hàng Vietcombank chi nhánh Ba Đình, Hà Nội.
                            </li>
                            <li>Thanh toán trực tiếp qua website của Công ty tại: /thanh-toan</li>
                            <li>Thanh toán bằng tiền mặt cho đối tác giúp việc.</li>
                        </ul>
                        <p>
                            Trong vòng 24h kể từ khi Quý khách thanh toán, chúng tôi sẽ gửi thư “Xác nhận Thanh toán Thành công” tới địa chỉ email Quý khách đã đăng ký hoặc Thông báo trên Ứng dụng HomieConnect, khi Quý khách cho phép gửi thông báo. Nếu Quý khách không nhận được xác nhận thanh toán, vui lòng phản hồi tới chúng tôi để kiểm tra và xử lý.
                        </p>
                        <p>
                            Khách hàng đồng ý trả các khoản chi phí cho dịch vụ giúp việc (“Phí”) có được thông qua kết nối. Sau khi Khách hàng nhận được dịch vụ giúp việc thông qua việc sử dụng Dịch vụ, Công ty sẽ thay mặt đối tác giúp việc thu hộ các khoản thanh toán Phí liên quan. Trong trường hợp pháp luật quy định, các khoản Phí sẽ bao gồm cả các khoản thuế và nghĩa vụ tài chính liên quan.
                        </p>

                        <h3>Điều 3: Quyền và nghĩa vụ của các Bên:</h3>

                        <h4>3.1. Quyền và nghĩa vụ của Khách hàng:</h4>
                        <ul>
                            <li>Yêu cầu Công ty thay đổi kết nối với đối tác giúp việc khác nếu không hài lòng về chất lượng dịch vụ;</li>
                            <li>Yêu cầu công ty cung cấp thông tin của đối tác giúp việc, bao gồm: CMND/CCCD, ảnh, họ tên;</li>
                            <li>Đơn phương chấm dứt Hợp đồng trong trường hợp Công ty có hành vi vi phạm Hợp đồng và không khắc phục hành vi vi phạm trong thời hạn 07 ngày làm việc;</li>
                            <li>Đảm bảo môi trường làm việc tốt, an toàn và lành mạnh cho đối tác giúp việc (không có hóa chất độc hại, không bị ô nhiễm, không có các hành vi quấy rối, xâm hại đến tính mạng, danh dự, nhân phẩm, thân thể của đối tác giúp việc);</li>
                            <li>Tự bảo quản và chịu trách nhiệm trong việc quản lý, bảo quản tài sản của mình trong mọi trường hợp;</li>
                            <li>Chủ động hướng dẫn cho đối tác giúp việc sử dụng các thiết bị điện trong nhà đảm bảo an toàn cho đối tác;</li>
                            <li>Đảm bảo thanh toán đúng hạn theo quy định tại Hợp đồng này;</li>
                            <li>Kịp thời thông báo cho Công ty trong vòng 24 giờ nếu phát hiện những hành vi tiêu cực từ phía đối tác giúp việc để hai Bên cùng phối hợp xử lý;</li>
                            <li>Không tự ý thỏa thuận với đối tác giúp việc để thay đổi nội dung công việc trong Hợp đồng, thay đổi giờ làm, yêu cầu thêm nội dung công việc, yêu cầu làm thêm giờ… nếu vi phạm Công ty có quyền đơn phương chấm dứt Hợp đồng dịch vụ và Khách hàng phải thanh toán cho Công ty một khoản tiền bồi thường tương đương với 8% giá trị Hợp đồng;</li>
                            <li>Trong trường hợp Khách hàng, bằng bất kỳ hình thức nào, nhận đối tác giúp việc vào làm việc cho Khách hàng trong thời gian sử dụng dịch vụ của Công ty hoặc trong vòng 3 tháng kể từ ngày chấm dứt Hợp đồng dịch vụ với Công ty thì Khách hàng sẽ phải trả chi phí tìm kiếm và đào tạo đối tác giúp việc đó cho Công ty, chi phí do Công ty xác định nhưng sẽ không thấp hơn 10.000.000 đồng (bằng chữ: Mười triệu đồng) một đối tác giúp việc;</li>
                            <li>Kiểm tra tài sản của mình khi đối tác giúp việc rời khỏi địa điểm làm việc;</li>
                            <li>Có trách nhiệm theo dõi thời gian làm việc của đối tác giúp việc thông qua ứng dụng HomieConnect. Theo đó, khi đối tác giúp việc bắt đầu và kết thúc làm việc, trên ứng dụng HomieConnect của khách hàng sẽ có thông báo về thời gian Bắt đầu và Kết thúc làm việc của đối tác giúp việc. Trong trường hợp nhận thấy đối tác giúp việc tính giờ làm chưa chính xác, Khách hàng cần phản hồi về sự việc với Công ty để Công ty tiến hành xử lý. Trong trường hợp Khách hàng không hài lòng với chất lượng công việc, Khách hàng có thể đánh giá chất lượng bằng số sao (*) trên ứng dụng HomieConnect để Công ty nhanh chóng tiếp nhận thông tin và xử lý;</li>
                            <li>Có trách nhiệm xác nhận bảng kê chi tiết phí dịch vụ hàng tháng do Công ty gửi sang vào ngày 05 hàng tháng trong thời hạn 07 ngày kể từ ngày nhận được bảng kê. Sau khoảng thời gian trên, nếu Khách hàng không có phản hồi thì bảng kê chi tiết dịch vụ tháng đó được coi là chính xác và là cơ sở để hai bên làm việc nếu có phát sinh sau này.</li>
                            <li>Trong trường hợp nghi ngờ đối tác giúp việc có hành vi trộm cắp tài sản của Khách hàng nhưng chưa có kết luận của cơ quan điều tra, Khách hàng không được cung cấp thông tin cho bất kỳ cá nhân, tổ chức nào làm ảnh hưởng đến uy tín, thương hiệu của Công ty. Nếu vi phạm Khách hàng phải thanh toán cho Công ty một khoản tiền bồi thường tương ứng với 8% giá trị Hợp đồng;</li>
                            <li>Thực hiện các cam kết khác theo quy định tại Hợp đồng này;</li>
                        </ul>

                        <h4>3.2. Quyền và nghĩa vụ của Công ty:</h4>
                        <ul>
                            <li>Đơn phương chấm dứt Hợp đồng trong trường hợp Khách hàng có hành vi vi phạm Hợp đồng và không khắc phục hành vi vi phạm trong thời hạn 07 ngày làm việc;</li>
                            <li>Kết nối đối tác giúp việc cho Khách hàng đảm bảo lý lịch, nguồn gốc rõ ràng;</li>
                            <li>Công ty, trong trường hợp có sẵn đối tác phù hợp với Khách hàng, tìm đối tác giúp việc thay thế cho Khách hàng nếu đối tác giúp việc đang làm việc cho Khách hàng nghỉ việc đột xuất (do ốm đau hoặc lý do cá nhân khác) hoặc nghỉ hẳn;</li>
                            <li>Quản lý, giám sát đối tác giúp việc, đảm bảo thực hiện đúng và đủ yêu cầu của Khách hàng đã quy định trong Hợp đồng (thời gian làm việc, lượng công việc hàng ngày…);</li>
                            <li>Thường xuyên trao đổi và ngay lập tức tiếp nhận thông tin phản hồi từ Khách hàng về chất lượng dịch vụ. Thực hiện việc kết nối đối tác khác thực hiện ca làm trong trường hợp Khách hàng đánh giá 1* trên ứng dụng và yêu cầu làm lại.</li>
                            <li>Công ty được miễn mọi trách nhiệm trong trường hợp phát sinh tranh chấp giữa Khách hàng và đối tác giúp việc nếu Khách hàng tự thỏa thuận với đối tác giúp việc để làm thêm ngoài khung giờ đã ký trong Hợp đồng dịch vụ này. Thực hiện các cam kết khác theo quy định tại Hợp đồng này.</li>
                        </ul>

                        <h3>Điều 4: Cam kết thực hiện:</h3>
                        <p>
                            4.1. Các Bên cam kết thực hiện đúng và đầy đủ các nghĩa vụ trong Hợp đồng.
                        </p>
                        <p>
                            4.2. Trong quá trình thực hiện Hợp đồng, nếu có phát sinh vấn đề ảnh hưởng đến quyền lợi của các Bên, Bên bị ảnh hưởng phải thông báo cho Bên kia trong thời hạn 24 giờ kể từ lúc phát sinh vấn đề.
                        </p>
                        <p>
                            4.3. Các Bên cam kết tôn trọng quyền lợi chính đáng của nhau, cam kết không tiết lộ thông tin Hợp đồng cho bất kỳ Bên thứ 3 nào khác.
                        </p>
                        <p>
                            4.4. Trường hợp Khách hàng giao chìa khóa cho đối tác giúp việc để thực hiện công việc, Khách hàng cam kết hành vi này của Khách hàng không tạo ra quan hệ gửi giữ tài sản giữa Khách hàng và Công ty. Công ty sẽ được miễn mọi trách nhiệm phát sinh trong trường hợp này.
                        </p>

                        <h3>Điều 5: Bất khả kháng:</h3>
                        <p>
                            Các bên được miễn trách nhiệm thực hiện nghĩa vụ của mình được quy định trong Hợp đồng trong các trường hợp sau:
                        </p>
                        <ul>
                            <li>5.1. Trong các trường hợp Bất khả kháng (thiên tai, dịch họa, động đất, chiến tranh…) theo như quy định của pháp luật Việt Nam, các Bên sẽ được miễn trách nhiệm thực hiện nghĩa vụ của mình được quy định trong Hợp đồng.</li>
                            <li>5.2. Một trong hai bên bị phá sản, tuyên bố phá sản, mất khả năng thanh toán.</li>
                        </ul>

                        <h3>Điều 6: Giải quyết tranh chấp và khiếu nại:</h3>
                        <p>
                            6.1. Khi xảy ra mâu thuẫn, tranh chấp, hai Bên sẽ ưu tiên tiến hành giải quyết thông qua việc tự thương lượng, hòa giải, trên tinh thần hỗ trợ lẫn nhau.
                        </p>
                        <p>
                            6.2. Nếu hai Bên không giải quyết được mâu thuẫn, tranh chấp theo quy định tại Điều 6, mục 6.1 của Hợp đồng này thì mọi mẫu thuẫn, tranh chấp sẽ được đưa ra giải quyết tại Tòa án Nhân dân có thẩm quyền.
                        </p>

                        <h3>Điều 7: Chính sách bảo mật thông tin Khách hàng</h3>
                        <p>
                            Bảo mật dữ liệu là vấn đề của sự tin tưởng. HomieConnect nhận thức được rằng việc bảo mật thông tin & danh tính của quý khách đặc biệt quan trọng. Vì vậy, chúng tôi cam kết sử dụng những thông tin mà quý khách cung cấp theo cách được đề ra trong Chính sách Bảo mật này.
                        </p>
                        <p>
                            Chúng tôi sẽ thu thập những thông tin cần thiết và có liên quan đến giao dịch giữa chúng tôi và quý khách.
                        </p>
                        <p>
                            Chúng tôi sử dụng cookies và công nghệ theo dấu khác để thu thập một số thông tin khi quý khách tương tác trên website & ứng dụng HomieConnect cho mục đích quảng cáo & chính sửa sản phẩm để nâng cao trải nghiệm.
                        </p>
                        <p>
                            Chúng tôi cam kết giữ thông tin của quý khách trong thời gian luật pháp yêu cầu hoặc cho mục đích mà thông tin đó được thu thập.
                        </p>
                        <p>
                            Quý khách có thể ghé thăm website mà không cần phải cung cấp bất kỳ thông tin cá nhân nào trừ khi quý khách có tài khoản và đăng nhập vào bằng tên và mật khẩu của mình.
                        </p>

                        <h4>7.1. Mục đích & phạm vi thu thập thông tin Khách hàng</h4>
                        <p>
                            7.1.1. Khi quý khách đăng ký tài khoản hoặc đặt dịch vụ tại website & ứng dụng HomieConnect, thông tin cá nhân mà chúng tôi thu thập bao gồm:
                        </p>
                        <ul>
                            <li>Họ & Tên Khách hàng</li>
                            <li>Địa chỉ sử dụng dịch vụ</li>
                            <li>Địa chỉ Email</li>
                            <li>Số điện thoại liên hệ hoặc địa chỉ Facebook Khách hàng</li>
                        </ul>
                        <p>
                            7.1.2. Những thông tin trên sẽ được sử dụng cho một hoặc tất cả các mục đích sau đây:
                        </p>
                        <ul>
                            <li>Liên hệ xác nhận khi quý khách đặt dịch vụ.</li>
                            <li>Cung cấp thông tin liên quan đến các dịch vụ do HomieConnect cung cấp & các chính sách hỗ trợ của HomieConnect.</li>
                            <li>Xử lý các yêu cầu cung cấp dịch vụ và thông tin qua ứng dụng & website của chúng tôi theo yêu cầu của quý khách.</li>
                            <li>Ngoài ra, chúng tôi sẽ sử dụng thông tin quý khách cung cấp để hỗ trợ quản lý tài khoản Khách hàng; xác nhận và thực hiện các giao dịch tài chính liên quan đến các khoản thanh toán trực tuyến của quý khách qua ứng dụng; kiểm tra dữ liệu tải từ website của chúng tôi; cải thiện giao diện hoặc nội dung của các trang mục trên ứng dụng & website để Khách hàng dễ dàng hơn khi sử dụng; nhận diện khách đến thăm website & ứng dụng; nghiên cứu về nhân khẩu học của người dùng; gửi đến quý khách thông tin mà chúng tôi nghĩ sẽ có ích hoặc do quý khách yêu cầu, bao gồm thông tin về sản phẩm và dịch vụ, với điều kiện quý khách đồng ý không phản đối việc được liên lạc cho các mục đích trên.</li>
                        </ul>

                        <p>7.1.3. Phạm vi sử dụng thông tin Khách hàng:</p>
                        <ul>
                            <li>Chia sẻ thông tin của quý khách cho các đối tác thanh toán trực tuyến của chúng tôi để có thể thực hiện dịch vụ cho quý khách. Danh sách các đơn vị gồm: VN Pay, Ví Điện Tử MoMo, Viettel Pay, Mobifone.</li>
                            <li>Gửi các thông tin khuyến mãi/quảng cáo, cung cấp các dịch vụ tiện ích đến quý khách. Quý khách có thể hủy nhận các thông tin đó bất kỳ lúc nào bằng cách sử dụng chức năng hủy đăng ký trong các thông báo quảng cáo.</li>
                            <li>Liên lạc với quý khách và giải quyết trong các trường hợp đặc biệt. Chi tiết đặt dịch vụ của quý khách sẽ được chúng tôi lưu trữ nhưng vì lý do bảo mật, quý khách không thể yêu cầu chúng tôi cung cấp lại những thông tin đó. Tuy nhiên, quý khách có thể kiểm tra thông tin bằng cách đăng nhập vào tài khoản của mình trên ứng dụng & website HomieConnect. Quý khách có thể theo dõi chi tiết những đơn hàng đã hoàn tất, đơn hàng mở và đơn hàng sắp được thực hiện; đồng thời quản lý & thay đổi thông tin cá nhân…</li>
                        </ul>

                        <h4>7.2. Cập nhật thay đổi thông tin cá nhân</h4>
                        <p>
                            Quý khách có thể cập nhật thông tin cá nhân của mình bất kỳ lúc nào bằng cách đăng nhập vào website & ứng dụng HomieConnect và hãy báo cho chúng tôi biết sự thay đổi để hỗ trợ quý khách được tốt nhất trong quá trình hậu mãi.
                        </p>
                        <p>
                            Quý khách cần bảo đảm là thông tin được truy cập một cách bí mật và không làm lộ cho một bên thứ ba khác không có quyền. Chúng tôi sẽ không chịu trách nhiệm đối với việc sử dụng sai mật khẩu trừ khi đó là lỗi của chúng tôi.
                        </p>

                        <h4>7.3. Bảo vệ thông tin Khách hàng</h4>
                        <p>
                            HomieConnect đảm bảo rằng mọi thông tin thu thập được sẽ được lưu giữ an toàn. Chúng tôi bảo vệ thông tin cá nhân của quý khách bằng cách:
                        </p>
                        <ul>
                            <li>Giới hạn truy cập thông tin cá nhân.</li>
                            <li>Sử dụng sản phẩm công nghệ bảo mật cao nhất để ngăn chặn truy cập hệ thống quản lý dữ liệu nội bộ trái phép.</li>
                            <li>Xóa mọi thông tin cá nhân của quý khách khi những thông tin đó không còn cần thiết cho mục đích lưu trữ dữ liệu của chúng tôi.</li>
                        </ul>

                        <h4>7.4. Tiêu chuẩn bảo mật với giao dịch thanh toán điện tử</h4>
                        <p>
                            7.4.1. Các giao dịch thanh toán bằng thẻ quốc tế và thẻ nội địa (internet banking) đảm bảo tuân thủ các tiêu chuẩn bảo mật của các Đối Tác Cổng Thanh Toán, gồm:
                        </p>
                        <ul>
                            <li>Thông tin tài chính của Khách hàng sẽ được bảo vệ trong suốt quá trình giao dịch bằng giao thức SSL (Secure Sockets Layer).</li>
                            <li>Chứng nhận tiêu chuẩn bảo mật dữ liệu thông tin thanh toán (PCI DSS) do Trustwave cung cấp.</li>
                            <li>Mật khẩu sử dụng một lần (OTP) được gửi qua SMS để đảm bảo việc truy cập tài khoản được xác thực.</li>
                            <li>Tiêu chuẩn mã hóa SHA 512 bit.</li>
                            <li>Các nguyên tắc và quy định bảo mật thông tin trong ngành tài chính ngân hàng theo quy định của Ngân hàng nhà nước Việt Nam.</li>
                        </ul>

                        <p>
                            7.4.2. Chính sách bảo mật giao dịch trong thanh toán của HomieConnect áp dụng với Khách hàng:
                        </p>
                        <p>
                            HomieConnect cam kết đảm bảo thực hiện nghiêm túc các biện pháp bảo mật cần thiết cho mọi hoạt động thanh toán thực hiện tại website & ứng dụng HomieConnect.
                        </p>

                        <h4>7.5. Cam kết của HomieConnect</h4>
                        <p>
                            Chúng tôi sẽ không chia sẻ hoặc tiết lộ thông tin của quý khách cho bất kỳ một tổ chức/cá nhân nào khác ngoại trừ những đối tác và các bên thứ ba có liên quan trực tiếp đến việc giao dịch trực tuyến hoặc thực hiện dịch vụ mà quý khách đã đặt tại website & ứng dụng HomieConnect.
                        </p>
                        <p>
                            Trong một vài trường hợp đặc biệt, HomieConnect có thể bị yêu cầu phải tiết lộ thông tin cá nhân, ví dụ khi có căn cứ cho việc tiết lộ thông tin là cần thiết để ngăn chặn các mối đe dọa về tính mạng và sức khỏe, hay cho mục đích thực thi pháp luật. HomieConnect cam kết tuân thủ Điều Luật Bảo Mật và các Nguyên tắc Bảo mật Quốc gia.
                        </p>
                        <p>
                            Nếu quý khách tin rằng thông tin của quý khách bị HomieConnect xâm phạm, xin vui lòng liên hệ với chúng tôi để được giải quyết.
                        </p>

                        <h4>7.6. Thay đổi của Chính sách Bảo mật</h4>
                        <p>
                            HomieConnect có quyền thay đổi và chỉnh sửa Quy định Bảo mật này vào bất kỳ lúc nào. Bất cứ sự thay đổi nào về chính sách này đều được đăng trên trang website & ứng dụng HomieConnect của chúng tôi.
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

export default TermsofServicePage;
