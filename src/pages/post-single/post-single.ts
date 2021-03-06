import { Component, NgZone, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { IonicPage, 
         NavController, 
         NavParams, 
         LoadingController, 
         ActionSheetController,
         MenuController,
         ToastController,
         AlertController,
         PopoverController } from 'ionic-angular';
import { PostsRes } from 'models/models';
import { postSinglePage } from './post-single.template';
import { AuthorProfilePage } from '../../pages/author-profile/author-profile';
import { SteemiaProvider } from 'providers/steemia/steemia';
import { SteeemActionsProvider } from 'providers/steeem-actions/steeem-actions';
import { SteemConnectProvider } from 'providers/steemconnect/steemconnect';
import { Subject } from 'rxjs/Subject';
import { AlertsProvider } from 'providers/alerts/alerts';
import { ERRORS } from '../../constants/constants';
import { UtilProvider } from 'providers/util/util';
import { Storage } from '@ionic/storage';
import { CameraProvider } from 'providers/camera/camera';

@IonicPage({
  priority: 'high'
})
@Component({
  selector: 'page-post-single',
  template: postSinglePage
})
export class PostSinglePage {
  @ViewChild('myInput') myInput: ElementRef;

  private post: any;
  private is_voting: boolean = false;
  private is_bookmarked: boolean = false;
  private comments: Array<any> = [];
  private is_loading: boolean = true;
  private is_logged_in: boolean = false;
  private profile: any;
  private current_user: string = "";
  private user;
  private chatBox: string = '';
  private is_owner: boolean = false;
  private ref;
  private bookmarks;
  private caret: number = 0;

  constructor(private zone: NgZone,
    private cdr: ChangeDetectorRef,
    public navCtrl: NavController,
    public navParams: NavParams,
    public menu: MenuController,
    private camera: CameraProvider,
    private actionSheetCtrl: ActionSheetController,
    public storage: Storage,
    private steemia: SteemiaProvider,
    private alerts: AlertsProvider,
    private popoverCtrl: PopoverController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    public util: UtilProvider,
    public loadingCtrl: LoadingController,
    private steemActions: SteeemActionsProvider,
    private steemConnect: SteemConnectProvider) { 
      this.user = (this.steemConnect.user_temp as any);
    } 

  ionViewDidLoad() {
    this.post = this.navParams.get('post');

    this.current_user = (this.steemConnect.user_temp as any).user;

    if (this.current_user === this.post.author) {
      this.is_owner = true;
    }

    this.zone.runOutsideAngular(() => {
      this.load_comments();
    });

    this.storage.ready().then(() => {
      this.storage.get('bookmarks').then(data => {
        if (data) {
          this.containsObject(data);
        }
        
      });
    });
  }

  ionViewDidEnter() {
    this.menu.enable(false);
  }

  ionViewDidLeave() {
    this.menu.enable(true);
  }

  private load_comments(action?: string) {
    this.steemia.dispatch_comments({
      permlink: encodeURIComponent(this.post.url),
      username: this.current_user
    }).then((comments: PostsRes) => {

      // Check if the action is to refresh. If so, we need to 
      // reinitialize all the data after initializing the query
      // to avoid the data to dissapear
      if (action === "refresh") {
        this.reinitialize();
      }
      this.comments = comments.results.reverse();

      // Set the loading spinner to false
      this.is_loading = false;

      // Tell Angular that changes were made since we detach the auto check
      this.cdr.detectChanges();
    });
  }

  private reinitialize() {
    this.comments = [];
  }

  /**
   * Method to get caret position in a textfield
   * @param oField 
   */
  getCaretPos(oField): void {
    let node = oField._elementRef.nativeElement.children[0];
    if (node.selectionStart || node.selectionStart == '0') {
      this.caret = node.selectionStart;
    }
  }

  /**
   * Method to open author profile page
   */
  private openProfile(): void {
    this.navCtrl.push(AuthorProfilePage, {
      author: this.post.author
    });
  }

  /**
   * Method to open the voting-slider popover
   */
  presentPopover(myEvent) {
    let popover = this.popoverCtrl.create('VotingSliderPage');
    popover.present({
      ev: myEvent
    });
    popover.onDidDismiss(data => {
      if (data) {
        this.castVote(this.post.author, this.post.url, data.weight);
      }
    });
  }

  /**
   * Method to cast a vote or unvote
   * @param i 
   * @param author 
   * @param permlink 
   * @param weight 
   */
  private castVote(author: string, permlink: string, weight: number = 1000): void {
    // Set the is voting value of the post to true
    this.is_voting = true;
    this.steemActions.dispatch_vote('posts', author, permlink, weight).then((data: any) => {
      this.is_voting = false; // remove the spinner
      // Catch if the user is not logged in and display an alert
      if (data.msg == 'not-logged') return;

      if (data.msg === 'correct') {
        if (data.type === 'vote') {
          this.post.vote = true;
        }

        else if (data.type === 'unvote') {
          this.post.vote = false;
        }
        this.refreshPost();
      }
      
    });
  }

  /**
   * Method to cast a flag
   * @param i 
   * @param author 
   * @param permlink 
   * @param weight 
   */
  private castFlag(author: string, permlink: string, weight: number = -10000): void {
    let loading = this.loadingCtrl.create({
      content: 'Please wait until the post is being flag.'
    });
    loading.present();
    this.steemActions.dispatch_vote('posts', author, permlink, weight).then(data => {

      loading.dismiss();
      // Catch if the user is not logged in and display an alert
      if (data == 'not-logged') {
        return;
      }

      else if (data === 'Correct') {
        this.toastCtrl.create({
          message: 'Post was flagged correctly!'
        });
      }

      else if (data === 'flag-error') {
        setTimeout(() => {
          this.alerts.display_alert('FLAG_ERROR');
        }, 200);
        
      }
    });
  }

  /**
   * Method to refresh the current data of the post
   */
  private refreshPost(): void {
    this.steemia.dispatch_post_single({
      author: this.post.author,
      permlink: this.post.url
    }).then(data => {
      //this.post.vote = (data as any).vote;
      this.post.net_likes = (data as any).net_likes;
      this.post.net_votes = (data as any).net_votes;
      this.post.top_likers_avatars = (data as any).top_likers_avatars;
      this.post.total_payout_reward = (data as any).total_payout_reward;
      this.post.children = (data as any).children;
    });
  }

  private reblog() {

    let loading = this.loadingCtrl.create({
      content: 'Hang on while we reblog this post 😎'
    });
    loading.present();
    this.steemActions.dispatch_reblog(this.post.author, this.post.url).then(data => {

      // Catch if the user is not logged in and display an alert
      if (data === 'not-logged') {
        this.show_prompt(loading, 'NOT_LOGGED_IN');
        return;
      }

      if (data === 'Correct') {
        this.show_prompt(loading, 'REBLOGGED_CORRECTLY');
      }

      if (data === 'ALREADY_REBLOGGED') {
        this.show_prompt(loading, 'ALREADY_REBLOGGED');
      }

    });
  }

  private show_prompt(loader, msg) {
    loader.dismiss();
    setTimeout(() => {
      this.alerts.display_alert(msg);
    }, 500);
  }

  private share() {
    this.steemActions.dispatch_share(this.post.url).then(res => {
      
    })
  }

  /**
   * Dispatch a comment to the current post
   */
  private comment() {
    if (this.chatBox.length === 0) {
      this.alerts.display_alert('EMPTY_TEXT');
      return;
    }

    let loading = this.loadingCtrl.create({
      content: 'Please wait...'
    });
    loading.present();
    this.steemActions.dispatch_comment(this.post.author, this.post.url, this.chatBox).then(res => {
      if (res === 'not-logged') {
        this.show_prompt(loading, 'NOT_LOGGED_IN');
        return;
      }

      else if (res === 'Correct') {
        this.chatBox = '';
        this.zone.runOutsideAngular(() => {
          this.load_comments('refresh');
        });
        loading.dismiss();
      }
      
      else if (res === 'COMMENT_INTERVAL') {
        this.show_prompt(loading, 'COMMENT_INTERVAL');
      }

    });
  }

  editPost() {
    this.navCtrl.push("EditPostPage", {
      post: this.post
    });
  }

  addBookmark() {
    if ((this.steemConnect.user_temp as any).user) {
      this.storage.get('bookmarks').then(data => {
        if(data) {
          this.bookmarks = data;
          this.bookmarks.push({ 
            author: this.post.author, 
            permlink: this.post.root_permlink, 
            url: this.post.url,
            title: this.post.title,
            body: this.post.body });
          this.storage.set('bookmarks', this.bookmarks).then(data => { 
            this.is_bookmarked = true;
            this.displayToast('saved');
          });
        } else {
          this.bookmarks = [{ 
            author: this.post.author, 
            permlink: this.post.root_permlink, 
            url: this.post.url,
            title: this.post.title,
            body: this.post.body 
          }];
          this.storage.set('bookmarks', this.bookmarks).then(data => { 
            this.is_bookmarked = true;
            this.displayToast('saved');
          });
        }
      });
    }
    else {
      this.alerts.display_alert('NOT_LOGGED_IN');
    }
    
  }

  removeBookmark() {
    if ((this.steemConnect.user_temp as any).user) {
      this.storage.get('bookmarks').then(data => {
        this.bookmarks = data;
        for(let object of data) {
          if (object.author === this.post.author && object.url === this.post.url) {
            let index = this.bookmarks.indexOf(object);
            this.bookmarks.splice(index,1);
            this.storage.set('bookmarks', this.bookmarks).then(data => {
              this.is_bookmarked = false;
              this.displayToast('removed');
            });
          }
        }
      });
    }
    else {
      this.alerts.display_alert('NOT_LOGGED_IN');
    }
  }

  displayToast(msg) {
    let toast = this.toastCtrl.create({
      message: 'Bookmark ' + msg + ' sucessfully',
      duration: 1500,
      position: 'bottom'
    }); 

    toast.present();
  }

  containsObject(array) {
    for(let object of array) {
      if (object.author === this.post.author && object.url === this.post.url) {
        this.is_bookmarked = true;
      }
    }
  } 

  protected adjustTextarea(event?: any): void {
    this.myInput['_elementRef'].nativeElement.getElementsByClassName("text-input")[0].style.height = 'auto';
    this.myInput['_elementRef'].nativeElement.getElementsByClassName("text-input")[0].style.height = this.myInput['_elementRef'].nativeElement.getElementsByClassName("text-input")[0].scrollHeight + 'px';
    return;
  }

  /**
   * Method to insert text at current pointer
   * @param {String} text: Text to insert 
   */
  insertText(text: string): void {
    const current = this.chatBox;
    let final = current.substr(0, this.caret) + text + current.substr(this.caret);
    this.chatBox = final;
    this.adjustTextarea();
  }

  /**
   * Method to present actionsheet with options
   */
  presentActionSheet(): void {
    if ((this.steemConnect.user_temp as any).user) {

      let actionSheet = this.actionSheetCtrl.create({
        title: 'How do you want to insert the image? 📷🌄',
        buttons: [
          {
            text: 'Camera',
            icon: 'camera',
            handler: () => {
              this.camera.choose_image(this.camera.FROM_CAMERA, false, 'comment').then((image: any) => {
                this.insertText(image);
              });
            }
          },
          {
            text: 'Gallery',
            icon: 'albums',
            handler: () => {
              this.camera.choose_image(this.camera.FROM_GALLERY, true, 'comment').then((image: any) => {
                this.insertText(image);
              });
            }
          },
          {
            text: 'Custom URL',
            icon: 'md-globe',
            handler: () => {
              this.presentInsertURL()
            }
          },
          {
            text: 'Cancel',
            icon: 'close',
            role: 'cancel',
            handler: () => {
            }
          }
        ]
      });
  
      actionSheet.present();

    }

    else {
      this.alerts.display_alert('NOT_LOGGED_IN');
    }
    
  }

  /**
   * Method to show insert URL actionsheet
   */
  presentInsertURL(): void {
    let alert = this.alertCtrl.create({
      title: 'Insert Image',
      inputs: [
        {
          name: 'URL',
          placeholder: 'Image URL'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: data => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'OK',
          handler: data => {
            this.insertText('![image](' + data.URL + ')');
          }
        }
      ]
    });
    alert.present();
  }

}
